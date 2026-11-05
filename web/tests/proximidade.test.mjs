import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { distanciaKm, maisProximos } = await carregaTs('utils/proximidade.ts')

const salvador = { nome: 'Salvador', lat: -12.97, lon: -38.5 }
const feira = { nome: 'Feira de Santana', lat: -12.27, lon: -38.97 }
const saoPaulo = { nome: 'São Paulo', lat: -23.55, lon: -46.63 }

test('distância entre capitais próxima da real', () => {
  const km = distanciaKm(salvador, saoPaulo)
  assert.ok(km > 1400 && km < 1500, String(km))
  assert.equal(distanciaKm(salvador, salvador), 0)
})

test('mais próximos vêm em ordem e ignoram quem não tem coordenada', () => {
  const lista = [saoPaulo, { nome: 'Sem dado', lat: 0, lon: 0 }, feira, salvador]
  const r = maisProximos(lista, { lat: -12.9, lon: -38.5 }, 2)
  assert.deepEqual(r.map((p) => p.item.nome), ['Salvador', 'Feira de Santana'])
})
