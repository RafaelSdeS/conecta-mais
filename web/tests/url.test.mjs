import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { cenarioDaUrl, cenarioParaUrl } = await carregaTs('utils/url.ts')

const padrao = {
  budget: 30,
  objetivo: 'equilibrado',
  levers: { fust: false, tcu: false, enec: false },
  filters: { uf: '', regiao: '', semiarido: false, quadrante: '' },
  view: 'painel',
  ficha: null,
}

test('cenário padrão não polui a URL e chaves alheias são preservadas', () => {
  assert.equal(cenarioParaUrl(padrao, ''), '')
  assert.equal(cenarioParaUrl(padrao, '?print=1&orcamento=150&m=2918407'), '?print=1')
})

test('cenário completo vai para a URL e volta igual', () => {
  const c = {
    budget: 150,
    objetivo: 'alunos',
    levers: { fust: true, tcu: false, enec: true },
    filters: { uf: 'BA', regiao: '', semiarido: true, quadrante: 'Q1' },
    view: 'chat',
    ficha: '2918407',
  }
  const url = cenarioParaUrl(c, '')
  assert.equal(url, '?orcamento=150&objetivo=alunos&alavancas=fust%2Cenec&uf=BA&semiarido=1&quadrante=Q1&view=chat&m=2918407')
  const lido = cenarioDaUrl(url)
  assert.deepEqual(
    { budget: lido.budget, objetivo: lido.objetivo, levers: lido.levers, filters: lido.filters, view: lido.view, ficha: lido.ficha },
    c,
  )
})

test('valores inválidos na URL são ignorados ou limitados à faixa do painel', () => {
  const lido = cenarioDaUrl('?orcamento=9999&objetivo=lucro&uf=ba')
  assert.equal(lido.budget, 500)
  assert.equal(lido.objetivo, undefined)
  assert.equal(lido.levers, undefined) // sem o parâmetro, as alavancas da tela ficam como estão
  assert.equal(lido.filters.uf, 'BA')
  assert.equal(cenarioDaUrl('?orcamento=abc').budget, undefined)
})
