import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { linkTelefone, textoCompartilhar, urlMapa, urlWhatsApp } = await carregaTs('utils/kit.ts')

test('links de mapa e mensagem escapam o texto', () => {
  assert.equal(urlMapa('Rua A, 1 - Centro'), 'https://www.google.com/maps/search/?api=1&query=Rua%20A%2C%201%20-%20Centro')
  assert.equal(urlWhatsApp('a b&c'), 'https://wa.me/?text=a%20b%26c')
})

test('telefone vira link com o código do país', () => {
  assert.equal(linkTelefone('(74) 99129-3015'), 'tel:+5574991293015')
})

test('texto compartilhado traz decisão, motivos, alerta e link', () => {
  const texto = textoCompartilhar({
    nome: 'Monte Santo', uf: 'BA', veredito: 'Só com apoio', explicacao: 'Depende de subsídio.',
    motivos: ['100 domicílios', '7 escolas'], alerta: 'VPL negativo.', link: 'https://x/?m=1',
  })
  assert.equal(texto, 'Monte Santo/BA: Só com apoio\nDepende de subsídio.\n- 100 domicílios\n- 7 escolas\nVPL negativo.\nFicha: https://x/?m=1')
})

test('sem alerta nem recomendação, não sobra linha vazia', () => {
  const texto = textoCompartilhar({ nome: 'A', uf: 'B', veredito: 'V', explicacao: 'E', motivos: [], alerta: null, link: 'L' })
  assert.equal(texto, 'A/B: V\nE\nFicha: L')
})

test('recomendação registrada entra no texto', () => {
  const texto = textoCompartilhar({
    nome: 'A', uf: 'B', veredito: 'V', explicacao: 'E', motivos: [], alerta: null,
    recomendacao: 'Minha recomendação: avançar. Prefeitura apoia.', link: 'L',
  })
  assert.match(texto, /Minha recomendação: avançar\. Prefeitura apoia\./)
})
