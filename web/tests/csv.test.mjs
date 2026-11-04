import assert from 'node:assert/strict'
import test from 'node:test'
import { carregaTs } from './carregaTs.mjs'

const { paraCsv } = await carregaTs('utils/csv.ts')
const cols = [{ chave: 'a', titulo: 'Nome' }, { chave: 'b', titulo: 'Valor' }]

test('CSV com BOM, separador ; e CRLF', () => {
  const csv = paraCsv([{ a: 'Escola X', b: 3 }], cols)
  assert.equal(csv, '﻿Nome;Valor\r\nEscola X;3')
})

test('escapa aspas, ponto e vírgula e quebras de linha', () => {
  const csv = paraCsv([{ a: 'Escola "Central"; anexo', b: null }, { a: 'linha\nquebrada', b: 1 }], cols)
  assert.ok(csv.includes('"Escola ""Central""; anexo";'))
  assert.ok(csv.includes('"linha\nquebrada";1'))
})
