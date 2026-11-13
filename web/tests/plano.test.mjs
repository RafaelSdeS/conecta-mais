import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { situacaoNoPlano } = await carregaTs('utils/constants.ts', 'utils/format.ts', 'utils/plano.ts')

const ctx = {
  portfolioIds: new Set(['1']),
  financeiro: {
    1: { id_municipio: '1', capex: 10, payback: 6, npv: 1 },
    2: { id_municipio: '2', capex: 5, payback: 12, npv: -1 },
    3: { id_municipio: '3', capex: 5, payback: null, npv: -2 },
    4: { id_municipio: '4', capex: 25, payback: 7, npv: 0 },
    5: { id_municipio: '5', capex: 8, payback: 7, npv: 0 },
  },
  budget: 30,
  capexUsado: 20,
  objetivo: 'retorno',
}

test('cada motivo de entrar ou ficar fora do plano', () => {
  const s = (id) => situacaoNoPlano(id, ctx)
  assert.equal(s('1').status, 'selecionado')
  assert.match(s('1').texto, /33% do orçamento/)
  assert.equal(s('9').status, 'fora_escopo')
  assert.equal(s('2').status, 'acima_teto')
  assert.match(s('3').texto, /não se paga/)
  assert.equal(s('4').status, 'sem_espaco')
  assert.match(s('4').texto, /sobram R\$ 10,00 mi/)
  assert.equal(s('5').status, 'preterido')
  assert.match(s('5').texto, /objetivo Retorno/)
})
