import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { aplicaFiltros } = await carregaTs('utils/regioes.ts', 'utils/filtros.ts')

const m = (id, nome, uf, quadrante, semiarido = false) => ({ id_municipio: id, nome, uf, quadrante, semiarido })
const base = [
  m('2927408', 'Salvador', 'BA', 'Q1'),
  m('2910800', 'Feira de Santana', 'BA', 'Q2a', true),
  m('2304400', 'Fortaleza', 'CE', 'Q1', true),
  m('3550308', 'São Paulo', 'SP', 'Q1'),
  m('4314902', 'Porto Alegre', 'RS', 'Q3'),
]
const vazio = { search: '', uf: '', regiao: '', semiarido: false, quadrante: '', portfolioOnly: false, favoritesOnly: false }
const ids = (f, port = new Set(), favs = new Set(), ignorar) =>
  aplicaFiltros(base, { ...vazio, ...f }, port, favs, ignorar).map((x) => x.id_municipio)

test('sem filtros devolve todos', () => assert.equal(ids({}).length, 5))

test('UF, região e Semiárido se combinam', () => {
  assert.deepEqual(ids({ uf: 'BA' }), ['2927408', '2910800'])
  assert.deepEqual(ids({ regiao: 'Nordeste', semiarido: true }), ['2910800', '2304400'])
  assert.deepEqual(ids({ regiao: 'Sul' }), ['4314902'])
})

test('busca ignora caixa e quadrante filtra', () => {
  assert.deepEqual(ids({ search: 'SÃO' }), ['3550308'])
  assert.deepEqual(ids({ quadrante: 'Q1', uf: 'CE' }), ['2304400'])
})

test('portfólio e favoritos usam os conjuntos recebidos', () => {
  assert.deepEqual(ids({ portfolioOnly: true }, new Set(['3550308'])), ['3550308'])
  assert.deepEqual(ids({ favoritesOnly: true }, new Set(), new Set(['2927408'])), ['2927408'])
})

test('ignorar permite contar quadrantes sem o próprio filtro de quadrante', () => {
  assert.equal(ids({ quadrante: 'Q3', uf: 'BA' }, new Set(), new Set(), 'quadrante').length, 2)
})

test('contagem por região ignorando o próprio filtro de região', () => {
  assert.equal(ids({ regiao: 'Sul', uf: 'BA' }, new Set(), new Set(), 'regiao').length, 2)
})

test('filtro por decisão: vigente ou pendente', () => {
  const vazio = { search: '', uf: '', regiao: '', semiarido: false, quadrante: '', portfolioOnly: false, favoritesOnly: false, decisao: '' }
  const dec = { 2927408: { decisao: 'aprovar' }, 2910800: { decisao: 'descartar' } }
  const ids = (decisao) => aplicaFiltros(base, { ...vazio, decisao }, new Set(), new Set(), undefined, dec).map((x) => x.id_municipio)
  assert.deepEqual(ids('aprovar'), ['2927408'])
  assert.equal(ids('pendente').length, base.length - 2)
  assert.equal(ids('').length, base.length)
})

