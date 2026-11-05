/** Agregações da base para a aba Solução (funções puras). */

import type { Municipio } from '../api/client'
import { REGIOES, regiaoDe, type Regiao } from './regioes'

export interface Resumo {
  municipios: number
  escolas: number
  escolasSemInternet: number
  alunosSemInternet: number
  comBackhaul: number
  semiarido: number
  q1q2a: number
  noPortfolio: number
}

const vazio = (): Resumo => ({
  municipios: 0, escolas: 0, escolasSemInternet: 0, alunosSemInternet: 0,
  comBackhaul: 0, semiarido: 0, q1q2a: 0, noPortfolio: 0,
})

function soma(r: Resumo, m: Municipio, portfolioIds: Set<string>) {
  r.municipios += 1
  r.escolas += m.total_escolas ?? 0
  r.escolasSemInternet += m.escolas_sem_internet_aprendizagem ?? 0
  r.alunosSemInternet += m.alunos_sem_internet ?? 0
  if (m.tem_backhaul_fibra) r.comBackhaul += 1
  if (m.semiarido) r.semiarido += 1
  if (m.quadrante === 'Q1' || m.quadrante === 'Q2a') r.q1q2a += 1
  if (portfolioIds.has(m.id_municipio)) r.noPortfolio += 1
}

export function resumoGeral(municipios: Municipio[], portfolioIds: Set<string> = new Set()): Resumo {
  const r = vazio()
  municipios.forEach((m) => soma(r, m, portfolioIds))
  return r
}

export function resumoPorRegiao(
  municipios: Municipio[],
  portfolioIds: Set<string> = new Set(),
): { regiao: Regiao; resumo: Resumo }[] {
  const porRegiao = new Map<Regiao, Resumo>(REGIOES.map((r) => [r, vazio()]))
  municipios.forEach((m) => {
    const regiao = regiaoDe(m.id_municipio)
    if (regiao) soma(porRegiao.get(regiao)!, m, portfolioIds)
  })
  return REGIOES.map((regiao) => ({ regiao, resumo: porRegiao.get(regiao)! }))
}

/** Posição do município por score total, na UF e no Brasil. */
export function posicao(municipios: Municipio[], m: Municipio) {
  const lugar = (lista: Municipio[]) => 1 + lista.filter((x) => x.score_total > m.score_total).length
  const daUf = municipios.filter((x) => x.uf === m.uf)
  return { uf: lugar(daUf), totalUf: daUf.length, brasil: lugar(municipios), totalBrasil: municipios.length }
}

/** Quantos saem de Q2b para Q2a por causa de uma alavanca ligada (0 enquanto não há listas oficiais). */
export function migramParaQ2a(municipios: Municipio[], levers: { fust: boolean; tcu: boolean }) {
  return municipios.filter((m) =>
    m.quadrante === 'Q2a' && ((levers.fust && m.fust_elegivel) || (levers.tcu && m.acordo_migracao))).length
}
