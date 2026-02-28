import { PDFDocument, StandardFonts, rgb, PDFFont, PDFImage } from 'pdf-lib'
import { COMPANY, CLAUSULAS_PADRAO, PALETE_INFO } from '@/lib/company'
import { formatDocument, formatPhone } from '@/lib/document'
import { fmtQuoteNumber } from '@/lib/format'

// ===== Tipos =====

export interface QuoteForPDF {
  number: number
  date: string
  validUntil: string
  projectName: string | null
  paymentTerms: string | null
  paymentMethod: string | null
  deliveryType: string | null
  deliveryAddress: string | null
  deliverySchedule: string | null
  notes: string | null
  totalAmount: number
  customer: {
    companyName: string
    tradeName: string | null
    document: string
    contactName: string | null
    phone: string | null
    email: string | null
  }
  items: Array<{
    product: { name: string }
    quantity: number
    unit: string
    unitPrice: number
    discount: number
    subtotal: number
  }>
}

export interface PDFImages {
  logo: Uint8Array | null
  selo30anos: Uint8Array | null
  seloISO: Uint8Array | null
}

// ===== Layout =====

const A4_W = 595.28
const A4_H = 841.89
const ML = 36 // margin left
const MR = 36 // margin right
const CW = A4_W - ML - MR // content width

const C = {
  navy: rgb(0.17, 0.24, 0.49),
  teal: rgb(0.23, 0.75, 0.71),
  black: rgb(0, 0, 0),
  dark: rgb(0.25, 0.25, 0.25),
  gray: rgb(0.45, 0.45, 0.45),
  light: rgb(0.88, 0.88, 0.88),
  vlight: rgb(0.96, 0.96, 0.96),
  white: rgb(1, 1, 1),
  rowAlt: rgb(0.95, 0.97, 1),
  tealBg: rgb(0.9, 0.97, 0.96),
  notesBg: rgb(1, 0.98, 0.94),
  notesBorder: rgb(0.9, 0.85, 0.7),
}

// ===== Helpers =====

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(test, size) > max && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.length > 0 ? lines : ['']
}

function money(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function qty(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function dateLong(iso: string): string {
  const d = new Date(iso)
  const m = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${d.getUTCDate()} de ${m[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

// ===== Gerador =====

export async function generateQuotePDF(quote: QuoteForPDF, images: PDFImages): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const pg = doc.addPage([A4_W, A4_H])
  const f = await doc.embedFont(StandardFonts.Helvetica)
  const fb = await doc.embedFont(StandardFonts.HelveticaBold)
  const fi = await doc.embedFont(StandardFonts.HelveticaOblique)

  let logo: PDFImage | null = null
  let selo: PDFImage | null = null
  let iso: PDFImage | null = null
  if (images.logo) logo = await doc.embedPng(images.logo)
  if (images.selo30anos) selo = await doc.embedPng(images.selo30anos)
  if (images.seloISO) iso = await doc.embedPng(images.seloISO)

  let y = A4_H - 32

  // ==================== HEADER ====================

  // Faixa teal topo
  pg.drawRectangle({ x: 0, y: A4_H - 3, width: A4_W, height: 3, color: C.teal })

  // Logo (esquerda)
  const logoH = 36
  if (logo) {
    const r = logo.width / logo.height
    pg.drawImage(logo, { x: ML, y: y - logoH + 4, width: logoH * r, height: logoH })
  }

  // Selos (direita): ISO + 30 anos lado a lado
  const seloH = 32
  const seloGap = 5
  let rx = A4_W - MR
  if (selo) {
    const sw = seloH * (selo.width / selo.height)
    rx -= sw
    pg.drawImage(selo, { x: rx, y: y - seloH + 4, width: sw, height: seloH })
    rx -= seloGap
  }
  if (iso) {
    const iw = seloH * (iso.width / iso.height)
    rx -= iw
    pg.drawImage(iso, { x: rx, y: y - seloH + 4, width: iw, height: seloH })
  }

  // Dados empresa (abaixo da logo)
  const ey = y - logoH - 3
  pg.drawText(COMPANY.razaoSocial, { x: ML, y: ey, size: 6.5, font: fb, color: C.navy })
  pg.drawText(`CNPJ: ${COMPANY.cnpj}`, { x: ML, y: ey - 9, size: 6.5, font: fb, color: C.navy })
  pg.drawText(`${COMPANY.endereco} - ${COMPANY.cidade}/${COMPANY.uf} - CEP ${COMPANY.cep}`, { x: ML, y: ey - 18, size: 6, font: f, color: C.gray })
  pg.drawText(`Fones: ${COMPANY.fones}  |  ${COMPANY.email}  |  ${COMPANY.site}`, { x: ML, y: ey - 27, size: 6, font: f, color: C.gray })

  // Linhas decorativas
  y = ey - 35
  pg.drawLine({ start: { x: ML, y }, end: { x: A4_W - MR, y }, thickness: 1.2, color: C.navy })
  pg.drawLine({ start: { x: ML, y: y - 2 }, end: { x: A4_W - MR, y: y - 2 }, thickness: 0.4, color: C.teal })

  // Título + badge
  y -= 14
  const title = 'PROPOSTA DE FORNECIMENTO DE MATERIAL'
  const tw = fb.widthOfTextAtSize(title, 11)
  pg.drawText(title, { x: (A4_W - tw) / 2, y, size: 11, font: fb, color: C.navy })

  y -= 14
  const badge = `${fmtQuoteNumber(quote.number)}  |  ${dateShort(quote.date)}`
  const bw = fb.widthOfTextAtSize(badge, 8)
  const bp = 10
  const bx = (A4_W - bw - bp * 2) / 2
  pg.drawRectangle({ x: bx, y: y - 3, width: bw + bp * 2, height: 14, color: C.tealBg, borderColor: C.teal, borderWidth: 0.4 })
  pg.drawText(badge, { x: bx + bp, y: y, size: 8, font: fb, color: C.navy })

  // ==================== METADADOS CLIENTE ====================

  y -= 22
  const cLines = 2 + (quote.projectName ? 1 : 0) + (quote.customer.contactName || quote.customer.phone || quote.customer.email ? 1 : 0)
  const boxH = cLines * 14 + 14
  pg.drawRectangle({ x: ML, y: y - boxH, width: CW, height: boxH, color: C.vlight, borderColor: C.light, borderWidth: 0.4 })
  pg.drawRectangle({ x: ML, y: y - boxH, width: 3, height: boxH, color: C.teal })

  const ix = ML + 10
  let iy = y - 10
  pg.drawText('CLIENTE', { x: ix, y: iy, size: 5.5, font: fb, color: C.teal })
  iy -= 12
  pg.drawText(quote.customer.companyName, { x: ix, y: iy, size: 8.5, font: fb, color: C.black })
  pg.drawText('CNPJ/CPF:', { x: 350, y: iy, size: 7, font: f, color: C.gray })
  pg.drawText(formatDocument(quote.customer.document), { x: 395, y: iy, size: 8.5, font: fb, color: C.black })

  if (quote.projectName) {
    iy -= 14
    pg.drawText('Obra:', { x: ix, y: iy, size: 7, font: f, color: C.gray })
    pg.drawText(quote.projectName, { x: ix + 26, y: iy, size: 8, font: fb, color: C.navy })
  }

  const ct = quote.customer.contactName
  const ph = quote.customer.phone
  const em = quote.customer.email
  if (ct || ph || em) {
    iy -= 14
    let cx = ix
    if (ct) {
      pg.drawText('Contato:', { x: cx, y: iy, size: 7, font: f, color: C.gray })
      pg.drawText(ct, { x: cx + 38, y: iy, size: 8, font: f, color: C.dark })
      cx += 38 + f.widthOfTextAtSize(ct, 8) + 15
    }
    if (ph) {
      pg.drawText('Fone:', { x: cx, y: iy, size: 7, font: f, color: C.gray })
      pg.drawText(formatPhone(ph), { x: cx + 26, y: iy, size: 8, font: f, color: C.dark })
      cx += 26 + f.widthOfTextAtSize(formatPhone(ph), 8) + 15
    }
    if (em) {
      pg.drawText('E-mail:', { x: cx, y: iy, size: 7, font: f, color: C.gray })
      pg.drawText(em, { x: cx + 32, y: iy, size: 8, font: f, color: C.dark })
    }
  }

  y -= boxH

  // ==================== INTRO ====================

  y -= 10
  pg.drawText('Prezado(a) cliente, atendendo sua solicitação, apresentamos a seguinte proposta:', {
    x: ML, y, size: 8, font: fi, color: C.dark,
  })

  // ==================== TABELA DE ITENS ====================

  y -= 14
  const cols = [
    { label: 'Item', w: 28, align: 'center' as const },
    { label: 'Descrição do Produto', w: 180, align: 'left' as const },
    { label: 'Unid.', w: 32, align: 'center' as const },
    { label: 'Quant.', w: 55, align: 'right' as const },
    { label: 'Preço Unit. (R$)', w: 82, align: 'right' as const },
    { label: 'Desc.', w: 32, align: 'center' as const },
    { label: 'Preço Total (R$)', w: CW - 28 - 180 - 32 - 55 - 82 - 32, align: 'right' as const },
  ]

  const hdrH = 20
  const rowH = 17
  const hdrFz = 7
  const rowFz = 7.5

  // Header tabela
  pg.drawRectangle({ x: ML, y: y - hdrH, width: CW, height: hdrH, color: C.navy })
  let colX = ML
  for (const col of cols) {
    const tw2 = fb.widthOfTextAtSize(col.label, hdrFz)
    let tx = colX + 4
    if (col.align === 'center') tx = colX + (col.w - tw2) / 2
    if (col.align === 'right') tx = colX + col.w - tw2 - 4
    pg.drawText(col.label, { x: tx, y: y - hdrH + 6, size: hdrFz, font: fb, color: C.white })
    colX += col.w
  }
  y -= hdrH

  // Linhas
  for (let i = 0; i < quote.items.length; i++) {
    const item = quote.items[i]
    const unitLabel = item.unit === 'M2' ? 'm²' : 'pç'
    const vals = [
      String(i + 1).padStart(2, '0'),
      item.product.name,
      unitLabel,
      qty(item.quantity),
      money(item.unitPrice),
      item.discount > 0 ? `${qty(item.discount)}%` : '-',
      money(item.subtotal),
    ]

    if (i % 2 === 0) {
      pg.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, color: C.rowAlt })
    }
    pg.drawLine({ start: { x: ML, y: y - rowH }, end: { x: ML + CW, y: y - rowH }, thickness: 0.2, color: C.light })

    colX = ML
    for (let j = 0; j < cols.length; j++) {
      const col = cols[j]
      const v = vals[j]
      const fnt = j === 0 ? fb : f
      const sz = j === 0 ? 7 : rowFz
      const clr = j === 0 ? C.navy : C.dark
      const vw = fnt.widthOfTextAtSize(v, sz)
      let tx = colX + 4
      if (col.align === 'center') tx = colX + (col.w - vw) / 2
      if (col.align === 'right') tx = colX + col.w - vw - 4
      pg.drawText(v, { x: tx, y: y - rowH + 5, size: sz, font: fnt, color: clr })
      colX += col.w
    }
    y -= rowH
  }

  // Linha TOTAL
  pg.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, color: C.navy })
  pg.drawText('VALOR TOTAL', { x: ML + 6, y: y - rowH + 5, size: 8, font: fb, color: C.white })
  const totalStr = `R$ ${money(quote.totalAmount)}`
  const totalW = fb.widthOfTextAtSize(totalStr, 9)
  pg.drawText(totalStr, { x: ML + CW - totalW - 4, y: y - rowH + 4, size: 9, font: fb, color: C.white })
  y -= rowH

  // ==================== OBSERVAÇÕES ====================

  if (quote.notes) {
    y -= 8
    const noteLines = wrap(quote.notes, f, 7, CW - 16)
    const nbH = noteLines.length * 9 + 16
    pg.drawRectangle({ x: ML, y: y - nbH, width: CW, height: nbH, color: C.notesBg, borderColor: C.notesBorder, borderWidth: 0.4 })
    pg.drawText('Obs.:', { x: ML + 6, y: y - 10, size: 6.5, font: fb, color: C.gray })
    for (let i = 0; i < noteLines.length; i++) {
      pg.drawText(noteLines[i], { x: ML + 28, y: y - 10 - i * 9, size: 7, font: f, color: C.dark })
    }
    y -= nbH
  }

  // ==================== CLÁUSULAS ====================

  y -= 8
  pg.drawText('Condições Gerais:', { x: ML, y, size: 7, font: fb, color: C.navy })
  y -= 10

  for (let c = 0; c < CLAUSULAS_PADRAO.length; c++) {
    const lines = wrap(CLAUSULAS_PADRAO[c], f, 6, CW - 22)
    pg.drawText(`${c + 1}.`, { x: ML + 3, y, size: 6, font: fb, color: C.gray })
    for (let i = 0; i < lines.length; i++) {
      pg.drawText(lines[i], { x: ML + 14, y: y - i * 8, size: 6, font: f, color: C.gray })
    }
    y -= lines.length * 8 + 2
  }

  // ==================== FRETE, PAGAMENTO, VALIDADE (3 colunas) ====================

  y -= 6

  // Desenhar as 3 seções lado a lado para economizar espaço vertical
  const col1x = ML
  const col2x = ML + CW * 0.38
  const col3x = ML + CW * 0.72
  const secY = y
  const secLabelSize = 7.5
  const secFieldLabel = 6.5
  const secFieldValue = 7
  const secLineH = 10

  // --- Coluna 1: Frete ---
  pg.drawLine({ start: { x: col1x, y: secY + 3 }, end: { x: col1x + 6, y: secY + 3 }, thickness: 1.5, color: C.teal })
  pg.drawText('1. Frete e Entrega', { x: col1x + 9, y: secY, size: secLabelSize, font: fb, color: C.navy })

  let sy = secY - 12
  const dt = quote.deliveryType || 'CIF'
  pg.drawText('Tipo:', { x: col1x + 4, y: sy, size: secFieldLabel, font: fb, color: C.dark })
  pg.drawText(dt === 'CIF' ? 'CIF (frete incluso)' : 'FOB (retira)', { x: col1x + 26, y: sy, size: secFieldValue, font: f, color: C.black })
  sy -= secLineH
  pg.drawText('Descarreg.:', { x: col1x + 4, y: sy, size: secFieldLabel, font: fb, color: C.dark })
  pg.drawText(dt === 'CIF' ? 'PROPOSTES' : 'Cliente', { x: col1x + 52, y: sy, size: secFieldValue, font: f, color: C.black })
  if (quote.deliveryAddress) {
    sy -= secLineH
    pg.drawText('Local:', { x: col1x + 4, y: sy, size: secFieldLabel, font: fb, color: C.dark })
    pg.drawText(quote.deliveryAddress, { x: col1x + 30, y: sy, size: secFieldValue, font: f, color: C.black })
  }
  sy -= secLineH
  pg.drawText('Programação:', { x: col1x + 4, y: sy, size: secFieldLabel, font: fb, color: C.dark })
  pg.drawText(quote.deliverySchedule || 'A combinar', { x: col1x + 58, y: sy, size: secFieldValue, font: f, color: C.black })

  // --- Coluna 2: Pagamento ---
  pg.drawLine({ start: { x: col2x, y: secY + 3 }, end: { x: col2x + 6, y: secY + 3 }, thickness: 1.5, color: C.teal })
  pg.drawText('2. Pagamento', { x: col2x + 9, y: secY, size: secLabelSize, font: fb, color: C.navy })

  sy = secY - 12
  pg.drawText('Prazo:', { x: col2x + 4, y: sy, size: secFieldLabel, font: fb, color: C.dark })
  pg.drawText(quote.paymentTerms || 'A combinar', { x: col2x + 30, y: sy, size: secFieldValue, font: f, color: C.black })
  sy -= secLineH
  pg.drawText('Forma:', { x: col2x + 4, y: sy, size: secFieldLabel, font: fb, color: C.dark })
  pg.drawText(quote.paymentMethod || 'A combinar', { x: col2x + 30, y: sy, size: secFieldValue, font: f, color: C.black })

  // --- Coluna 3: Validade ---
  pg.drawLine({ start: { x: col3x, y: secY + 3 }, end: { x: col3x + 6, y: secY + 3 }, thickness: 1.5, color: C.teal })
  pg.drawText('3. Validade', { x: col3x + 9, y: secY, size: secLabelSize, font: fb, color: C.navy })

  sy = secY - 12
  pg.drawText(dateShort(quote.validUntil), { x: col3x + 4, y: sy, size: secFieldValue, font: fb, color: C.black })

  // Palete (abaixo das 3 colunas, linha única)
  const palY = secY - (quote.deliveryAddress ? 55 : 45)
  const palLines = wrap(`Palete: ${PALETE_INFO}`, f, 5.5, CW - 6)
  for (let i = 0; i < palLines.length; i++) {
    pg.drawText(palLines[i], { x: ML + 3, y: palY - i * 7, size: 5.5, font: f, color: C.gray })
  }
  y = palY - palLines.length * 7

  // ==================== ASSINATURA ====================

  y -= 10
  const dateStr = `${COMPANY.cidade}, ${dateLong(quote.date)}.`
  const dw = f.widthOfTextAtSize(dateStr, 8)
  pg.drawText(dateStr, { x: (A4_W - dw) / 2, y, size: 8, font: f, color: C.dark })

  y -= 28
  const sigW = 160
  const leftCenter = ML + 18 + sigW / 2
  const rightX = A4_W / 2 + 25

  // Esquerda: Gerente
  pg.drawLine({ start: { x: ML + 18, y }, end: { x: ML + 18 + sigW, y }, thickness: 0.6, color: C.navy })
  const mgr = COMPANY.responsavel
  let nw = fb.widthOfTextAtSize(mgr.nome, 7.5)
  pg.drawText(mgr.nome, { x: leftCenter - nw / 2, y: y - 10, size: 7.5, font: fb, color: C.black })
  nw = f.widthOfTextAtSize(mgr.cargo, 7)
  pg.drawText(mgr.cargo, { x: leftCenter - nw / 2, y: y - 19, size: 7, font: f, color: C.gray })
  nw = f.widthOfTextAtSize(mgr.fone, 6.5)
  pg.drawText(mgr.fone, { x: leftCenter - nw / 2, y: y - 27, size: 6.5, font: f, color: C.gray })
  nw = f.widthOfTextAtSize(mgr.email, 6.5)
  pg.drawText(mgr.email, { x: leftCenter - nw / 2, y: y - 35, size: 6.5, font: f, color: C.gray })

  // Direita: De acordo
  pg.drawText('De acordo:', { x: rightX, y: y + 10, size: 7, font: fi, color: C.gray })
  pg.drawLine({ start: { x: rightX, y }, end: { x: rightX + sigW, y }, thickness: 0.6, color: C.navy })
  pg.drawText('Nome:', { x: rightX, y: y - 10, size: 6.5, font: f, color: C.gray })
  pg.drawLine({ start: { x: rightX + 28, y: y - 12 }, end: { x: rightX + sigW, y: y - 12 }, thickness: 0.2, color: C.light })
  pg.drawText('Data:', { x: rightX, y: y - 22, size: 6.5, font: f, color: C.gray })
  pg.drawLine({ start: { x: rightX + 28, y: y - 24 }, end: { x: rightX + sigW, y: y - 24 }, thickness: 0.2, color: C.light })

  // ==================== FOOTER ====================

  const fy = 22
  pg.drawLine({ start: { x: ML, y: fy + 10 }, end: { x: A4_W - MR, y: fy + 10 }, thickness: 0.4, color: C.light })
  const ftxt = `${COMPANY.nomeFantasia} - ${COMPANY.site}`
  const ftw = f.widthOfTextAtSize(ftxt, 6)
  pg.drawText(ftxt, { x: (A4_W - ftw) / 2, y: fy, size: 6, font: f, color: C.gray })

  return doc.save()
}
