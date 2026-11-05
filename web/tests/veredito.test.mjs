import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { alertaFinanceiro, limitesDados, motivos, priorizar, veredito } = await carregaTs('utils/format.ts', 'utils/veredito.ts')

const m = (quadrante, extra = {}) => ({
  quadrante, domicilios_urbanos: 1000, acessos_fibra: 250, alunos_sem_internet: 120,
  escolas_sem_internet_aprendizagem: 3, tem_backhaul_fibra: false, dist_backhaul_km: 12, ...extra,
})
const bom = { capex: 10, payback: 5.7, npv: -1 }
const ruim = { capex: 10, payback: 9, npv: -5 }

test('veredito segue quadrante e retorno', () => {
  assert.equal(veredito(m('Q1'), bom).titulo, 'Levar adiante')
  assert.equal(veredito(m('Q1'), ruim).titulo, 'Só com apoio')
  assert.equal(veredito(m('Q3'), bom).titulo, 'Levar adiante pelo comercial')
  assert.equal(veredito(m('Q3'), ruim).titulo, 'Avaliar compra ou parceria')
  assert.equal(veredito(m('Q2a'), bom).titulo, 'Só com apoio')
  assert.equal(veredito(m('Q2b'), bom).titulo, 'Só com apoio')
  assert.equal(veredito(m('Q4'), bom).titulo, 'Não priorizar agora')
})

test('sem retorno calculado, Q1 e Q3 esperam em vez de chutar', () => {
  assert.equal(veredito(m('Q1')).nivel, 'pendente')
  assert.equal(veredito(m('Q3')).nivel, 'pendente')
  assert.equal(veredito(m('Q4')).nivel, 'nao')
})

test('payback nulo nunca conta como retorno bom', () => {
  assert.equal(veredito(m('Q1'), { capex: 10, payback: null, npv: -5 }).titulo, 'Só com apoio')
})

test('limite de 6 anos entra como retorno bom', () => {
  assert.equal(veredito(m('Q1'), { capex: 10, payback: 6, npv: -1 }).titulo, 'Levar adiante')
})

test('prioridade: quem avança vem antes de quem depende de apoio e de quem espera', () => {
  const ordem = (q, f) => veredito(m(q), f).ordem
  assert.ok(ordem('Q1', bom) < ordem('Q3', bom))
  assert.ok(ordem('Q3', bom) < ordem('Q2b', bom))
  assert.ok(ordem('Q2b', bom) < ordem('Q3', ruim))
  assert.ok(ordem('Q3', ruim) < ordem('Q4', bom))
})

test('motivos trazem os números que sustentam o veredito', () => {
  const [mercado, escolas, retorno] = motivos(m('Q1'), bom)
  assert.match(mercado, /75% sem fibra/)
  assert.match(escolas, /120 alunos em 3 escolas/)
  assert.match(retorno, /retorno em 5,7 anos; fibra de transporte a 12 km/)
})

test('motivos cobrem município sem escola afetada, com fibra e sem retorno', () => {
  const lista = motivos(m('Q1', { escolas_sem_internet_aprendizagem: 0, tem_backhaul_fibra: true }), { capex: 1, payback: null, npv: -1 })
  assert.match(lista[1], /Nenhuma escola/)
  assert.match(lista[2], /sem retorno no horizonte; já tem fibra/)
})

test('penetração acima de 100% não vira percentual negativo', () => {
  assert.match(motivos(m('Q1', { acessos_fibra: 5000 }), bom)[0], /cerca de 0% sem fibra/)
})

test('alerta aparece só com VPL negativo', () => {
  assert.match(alertaFinanceiro(ruim), /negativo/)
  assert.equal(alertaFinanceiro({ capex: 1, payback: 3, npv: 2 }), null)
  assert.equal(alertaFinanceiro(undefined), null)
})

test('limites dos dados saem em linguagem simples', () => {
  const texto = limitesDados([
    { campo: 'fust_elegivel', tipo: 'neutro', cobertura: 0 },
    { campo: 'ivs', tipo: 'aproximado', cobertura: 0.8 },
    { campo: 'hhi', tipo: 'real', cobertura: 0.8 },
  ])
  assert.equal(texto, 'Sem dados de: elegibilidade ao FUST. Aproximados: vulnerabilidade social (média do estado).')
  assert.equal(limitesDados([]), null)
})

test('priorizar ordena por veredito e score e deixa de fora quem não é prioridade', () => {
  const lista = [
    m('Q4', { id_municipio: 'a', score_total: 90 }),
    m('Q2b', { id_municipio: 'b', score_total: 80 }),
    m('Q1', { id_municipio: 'c', score_total: 40 }),
    m('Q1', { id_municipio: 'd', score_total: 50 }),
    m('Q3', { id_municipio: 'e', score_total: 99 }),
  ]
  const fin = { c: bom, d: bom, e: bom }
  assert.deepEqual(priorizar(lista, fin).map((x) => x.id_municipio), ['d', 'c', 'e', 'b'])
})

test('priorizar não lista quem ainda está calculando', () => {
  assert.deepEqual(priorizar([m('Q1', { id_municipio: 'a', score_total: 1 })], {}), [])
})

test('impacto alto sem escola afetada explica de onde vem o impacto, sem se contradizer', () => {
  const semEscola = { escolas_sem_internet_aprendizagem: 0 }
  assert.match(motivos(m('Q2b', semEscola), bom)[1], /impacto calculado vem de fatores como zona rural/)
  assert.doesNotMatch(motivos(m('Q4', semEscola), bom)[1], /impacto calculado/)
})

