import { prisma } from '@/lib/prisma'
import { generateQuotePDF, type QuoteForPDF, type PDFImages } from '@/lib/pdf/generate-quote-pdf'
import fs from 'fs'
import path from 'path'

function loadImage(fileName: string): Uint8Array | null {
  try {
    const filePath = path.join(process.cwd(), 'assets', 'images', fileName)
    return fs.readFileSync(filePath)
  } catch {
    return null
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          companyName: true,
          tradeName: true,
          document: true,
          contactName: true,
          phone: true,
          email: true,
        },
      },
      items: {
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!quote) {
    return new Response('Orçamento não encontrado', { status: 404 })
  }

  const quoteForPDF: QuoteForPDF = {
    number: quote.number,
    date: quote.date.toISOString(),
    validUntil: quote.validUntil.toISOString(),
    projectName: quote.projectName,
    paymentTerms: quote.paymentTerms,
    paymentMethod: quote.paymentMethod,
    deliveryType: quote.deliveryType,
    deliveryAddress: quote.deliveryAddress,
    deliverySchedule: quote.deliverySchedule,
    notes: quote.notes,
    totalAmount: quote.totalAmount,
    customer: quote.customer,
    items: quote.items.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      subtotal: item.subtotal,
    })),
  }

  // Carregar imagens no contexto server-side da rota
  const images: PDFImages = {
    logo: loadImage('logo-propostes.png'),
    selo30anos: loadImage('selo-30-anos.png'),
    seloISO: loadImage('selo-iso9001.png'),
  }

  try {
    const pdfBytes = await generateQuotePDF(quoteForPDF, images)

    const fileName = `Proposta-${String(quote.number).padStart(4, '0')}.pdf`

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao gerar PDF' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
