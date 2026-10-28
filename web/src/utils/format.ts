/** Formatadores de valores usados em toda a aplicação. */

/** R$ X.XX mi */
export function fmtMi(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi'
}

/** X,X anos */
export function fmtAnos(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '∞'
  return v.toFixed(1) + ' anos'
}

/** Número inteiro com separador de milhar */
export function fmtN0(v: number | null | undefined): string {
  if (v == null) return '—'
  return Math.round(v).toLocaleString('pt-BR')
}

/** Percentual com 1 casa decimal */
export function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return (v * 100).toFixed(1) + '%'
}
