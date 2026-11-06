/**
 * Cenário da tela ⇄ URL (funções puras): recarregar a página mantém o cenário, a aba e a ficha,
 * e o link abre a tela pronta, ex.: /?uf=BA&semiarido=1&orcamento=150&objetivo=alunos&alavancas=fust
 */

import type { Objetivo } from '../api/client'

export interface CenarioUrl {
  budget: number
  objetivo: Objetivo
  levers: { fust: boolean; tcu: boolean; enec: boolean }
  filters: { uf: string; regiao: string; semiarido: boolean; quadrante: string }
  view: string
  /** Código IBGE da ficha aberta, ou null. */
  ficha: string | null
}

const ALAVANCAS = ['fust', 'tcu', 'enec'] as const
const OBJETIVOS_VALIDOS: Objetivo[] = ['retorno', 'equilibrado', 'alunos']

/**
 * Query string com o cenário. Só mexe nas chaves do cenário e preserva as demais (ex.: print).
 * Valores padrão (R$ 30 mi, Equilíbrio, sem alavancas, Painel) ficam fora para a URL ficar curta.
 */
export function cenarioParaUrl(c: CenarioUrl, search: string): string {
  const q = new URLSearchParams(search)
  const pares: [string, string | null][] = [
    ['orcamento', c.budget !== 30 ? String(c.budget) : null],
    ['objetivo', c.objetivo !== 'equilibrado' ? c.objetivo : null],
    ['alavancas', ALAVANCAS.filter((a) => c.levers[a]).join(',') || null],
    ['uf', c.filters.uf || null],
    ['regiao', c.filters.regiao || null],
    ['semiarido', c.filters.semiarido ? '1' : null],
    ['quadrante', c.filters.quadrante || null],
    ['view', c.view !== 'painel' ? c.view : null],
    ['m', c.ficha],
  ]
  for (const [chave, valor] of pares) {
    if (valor == null) q.delete(chave)
    else q.set(chave, valor)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** Cenário lido da URL; orçamento, objetivo e alavancas só vêm quando presentes e válidos. */
export function cenarioDaUrl(search: string): {
  budget?: number
  objetivo?: Objetivo
  levers?: CenarioUrl['levers']
  filters: CenarioUrl['filters']
  view?: string
  ficha?: string
} {
  const q = new URLSearchParams(search)
  const orcamento = Number(q.get('orcamento'))
  const objetivo = q.get('objetivo') as Objetivo | null
  const alavancas = q.get('alavancas')?.split(',')
  return {
    ...(q.has('orcamento') && Number.isFinite(orcamento)
      ? { budget: Math.min(500, Math.max(5, orcamento)) } : {}),
    ...(objetivo && OBJETIVOS_VALIDOS.includes(objetivo) ? { objetivo } : {}),
    ...(alavancas
      ? { levers: { fust: alavancas.includes('fust'), tcu: alavancas.includes('tcu'), enec: alavancas.includes('enec') } }
      : {}),
    filters: {
      uf: q.get('uf')?.toUpperCase() ?? '',
      regiao: q.get('regiao') ?? '',
      semiarido: q.get('semiarido') === '1',
      quadrante: q.get('quadrante') ?? '',
    },
    ...(q.get('view') ? { view: q.get('view')! } : {}),
    ...(q.get('m') ? { ficha: q.get('m')! } : {}),
  }
}
