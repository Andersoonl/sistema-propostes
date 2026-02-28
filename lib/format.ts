/**
 * Formatação de números no padrão brasileiro:
 * - Ponto (.) separa milhares
 * - Vírgula (,) separa decimais
 */

/** Formata número inteiro com separador de milhares */
export function fmtInt(value: number): string {
  return Math.round(value).toLocaleString('pt-BR')
}

/** Formata número com N casas decimais */
export function fmtDec(value: number, decimals: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Formata número com até N casas decimais (sem zeros à direita) */
export function fmtMax(value: number, maxDecimals: number): string {
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: maxDecimals,
  })
}

/** Formata valor monetário (R$ 1.234,56) */
export function fmtMoney(value: number, decimals: number = 2): string {
  return `R$ ${fmtDec(value, decimals)}`
}

/** Formata percentual (ex: 12,5%) */
export function fmtPct(value: number, decimals: number = 1): string {
  return `${fmtDec(value, decimals)}%`
}

/** Formata número de orçamento (ex: ORC-0001) */
export function fmtQuoteNumber(n: number): string {
  return `ORC-${String(n).padStart(4, '0')}`
}

/** Formata número de pedido (ex: PED-0001) */
export function fmtOrderNumber(n: number): string {
  return `PED-${String(n).padStart(4, '0')}`
}

/** Formata número de ordem de produção (ex: OP-0001) */
export function fmtProductionOrderNumber(n: number): string {
  return `OP-${String(n).padStart(4, '0')}`
}

/** Formata número de entrega (ex: ENT-0001) */
export function fmtDeliveryNumber(n: number): string {
  return `ENT-${String(n).padStart(4, '0')}`
}

/** Formata número de conta a receber (ex: REC-0001) */
export function fmtReceivableNumber(n: number): string {
  return `REC-${String(n).padStart(4, '0')}`
}

/** Formata número de conta a pagar (ex: PAG-0001) */
export function fmtPayableNumber(n: number): string {
  return `PAG-${String(n).padStart(4, '0')}`
}
