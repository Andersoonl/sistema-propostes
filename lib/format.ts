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
