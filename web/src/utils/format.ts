/** Formatadores de valores usados em toda a aplicação. */

/** R$ X.XX mi */
export function fmtMi(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi'
}

/** X,X anos */
export function fmtAnos(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '∞'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' anos'
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

/** Cenário em uma linha (cabeçalho impresso da ficha e do dossiê). */
export function descreveCenario(c: {
  budget: number
  objetivo: string
  levers: { fust: boolean; tcu: boolean; enec: boolean }
  params: { arpu_mensal: number; adesao_pct: number; wacc: number }
}): string {
  const alavancas = [c.levers.tcu && 'TCU', c.levers.fust && 'FUST', c.levers.enec && 'ENEC'].filter(Boolean).join(', ') || 'nenhuma'
  return `orçamento R$ ${c.budget} mi · objetivo ${c.objetivo} · alavancas: ${alavancas} · `
    + `ARPU R$ ${c.params.arpu_mensal.toLocaleString('pt-BR')} · adesão ${(c.params.adesao_pct * 100).toFixed(0)}% · `
    + `WACC ${(c.params.wacc * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
