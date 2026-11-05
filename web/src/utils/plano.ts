/** Por que um município entrou ou não no plano do cenário atual (função pura, sem React). */

import type { FinanceiroLinha, Objetivo } from '../api/client'
import { OBJETIVOS, TETO_PAYBACK_ANOS } from './constants'
import { fmtAnos, fmtMi } from './format'

export type StatusPlano = 'selecionado' | 'fora_escopo' | 'acima_teto' | 'sem_espaco' | 'preterido'

export interface ContextoPlano {
  portfolioIds: Set<string>
  /** Business case do cenário; só tem os municípios do escopo atual. */
  financeiro: Record<string, FinanceiroLinha>
  budget: number
  capexUsado: number
  objetivo: Objetivo
}

export function situacaoNoPlano(id: string, c: ContextoPlano): { status: StatusPlano; texto: string } {
  const f = c.financeiro[id]
  if (!f) {
    return { status: 'fora_escopo', texto: 'Fora do escopo atual (UF, região ou Semiárido escolhidos nos filtros).' }
  }
  if (c.portfolioIds.has(id)) {
    const pct = c.budget > 0 ? Math.round((f.capex / c.budget) * 100) : 0
    return { status: 'selecionado', texto: `Entrou no plano: usa ${fmtMi(f.capex)} (${pct}% do orçamento de R$ ${c.budget} mi).` }
  }
  if (f.payback == null || f.payback > TETO_PAYBACK_ANOS) {
    const pb = f.payback == null ? 'não se paga no horizonte do projeto' : `payback de ${fmtAnos(f.payback)}`
    return { status: 'acima_teto', texto: `Ficou fora: ${pb}, acima do teto de ${TETO_PAYBACK_ANOS} anos.` }
  }
  const livre = Math.max(0, c.budget - c.capexUsado)
  if (f.capex > livre) {
    return { status: 'sem_espaco', texto: `Ficou fora: custa ${fmtMi(f.capex)} e sobram ${fmtMi(livre)} no orçamento.` }
  }
  const objetivo = OBJETIVOS.find((o) => o.value === c.objetivo)?.label ?? c.objetivo
  return {
    status: 'preterido',
    texto: `Ficou fora: cabe no orçamento (${fmtMi(f.capex)}), mas o objetivo ${objetivo} priorizou outros municípios.`,
  }
}
