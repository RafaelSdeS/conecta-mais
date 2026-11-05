import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { migramParaQ2a, posicao, resumoGeral, resumoPorRegiao } = await carregaTs('utils/regioes.ts', 'utils/resumo.ts')

const m = (id, extra = {}) => ({
  id_municipio: id, quadrante: 'Q4', total_escolas: 10, escolas_sem_internet_aprendizagem: 2,
  alunos_sem_internet: 100, tem_backhaul_fibra: false, semiarido: false, ...extra,
})
const base = [
  m('2927408', { quadrante: 'Q1', tem_backhaul_fibra: true }),
  m('2304400', { quadrante: 'Q2a', semiarido: true }),
  m('3550308', { quadrante: 'Q1' }),
  m('4314902'),
]

test('resumo geral soma escolas, alunos, backhaul e semiárido', () => {
  const r = resumoGeral(base, new Set(['3550308']))
  assert.deepEqual(
    [r.municipios, r.escolas, r.escolasSemInternet, r.alunosSemInternet, r.comBackhaul, r.semiarido, r.q1q2a, r.noPortfolio],
    [4, 40, 8, 400, 1, 1, 3, 1],
  )
})

test('por região: cobre as 5 regiões e a soma bate com o geral', () => {
  const regioes = resumoPorRegiao(base)
  assert.deepEqual(regioes.map((r) => r.regiao), ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'])
  assert.equal(regioes.find((r) => r.regiao === 'Nordeste').resumo.municipios, 2)
  assert.equal(regioes.reduce((s, r) => s + r.resumo.alunosSemInternet, 0), resumoGeral(base).alunosSemInternet)
})

test('posição conta quem tem score maior, na UF e no Brasil', () => {
  const lista = [
    { uf: 'BA', score_total: 50 }, { uf: 'BA', score_total: 30 }, { uf: 'SP', score_total: 70 }, { uf: 'BA', score_total: 30 },
  ]
  assert.deepEqual(posicao(lista, lista[1]), { uf: 2, totalUf: 3, brasil: 3, totalBrasil: 4 })
})

test('migram para Q2a só com a alavanca do município ligada', () => {
  const lista = [
    { quadrante: 'Q2a', fust_elegivel: true, acordo_migracao: false },
    { quadrante: 'Q2a', fust_elegivel: false, acordo_migracao: true },
    { quadrante: 'Q2b', fust_elegivel: true, acordo_migracao: true },
  ]
  assert.equal(migramParaQ2a(lista, { fust: true, tcu: false }), 1)
  assert.equal(migramParaQ2a(lista, { fust: true, tcu: true }), 2)
  assert.equal(migramParaQ2a(lista, { fust: false, tcu: false }), 0)
})
