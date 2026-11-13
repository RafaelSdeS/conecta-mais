import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { resumoGeral, resumoPorRegiao } = await carregaTs('utils/regioes.ts', 'utils/resumo.ts')

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
