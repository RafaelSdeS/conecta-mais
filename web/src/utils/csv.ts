/** Geração de CSV (funções puras) para as listas que as secretarias baixam. */

const escapa = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV com separador ";" (abre direto no Excel em pt-BR) e BOM UTF-8. */
export function paraCsv<T extends Record<string, unknown>>(
  linhas: T[],
  colunas: { chave: keyof T & string; titulo: string }[],
): string {
  const cabecalho = colunas.map((c) => escapa(c.titulo)).join(';')
  const corpo = linhas.map((l) => colunas.map((c) => escapa(l[c.chave])).join(';'))
  return '﻿' + [cabecalho, ...corpo].join('\r\n')
}

export function baixaCsv(nomeArquivo: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}
