/**
 * Recomendações registradas em campo, persistidas no localStorage (mesmo padrão de useFavorites).
 */

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'cm_recomendacoes'

export type Decisao = 'avancar' | 'aguardar' | 'descartar'

export const ROTULO_DECISAO: Record<Decisao, string> = {
  avancar: 'Avançar',
  aguardar: 'Aguardar',
  descartar: 'Descartar',
}

export interface Recomendacao {
  decisao: Decisao
  nota: string
  data: string
}

type Mapa = Record<string, Recomendacao>

function carrega(): Mapa {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Mapa
  } catch {
    return {}
  }
}

let recomendacoes = carrega()
const ouvintes = new Set<() => void>()

// ponytail: fica só neste aparelho; POST /decisoes com login quando mais de uma pessoa precisar ver
export function salvaRecomendacao(id: string, decisao: Decisao, nota: string): void {
  recomendacoes = { ...recomendacoes, [id]: { decisao, nota: nota.trim(), data: new Date().toISOString() } }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recomendacoes))
  } catch {
    // armazenamento indisponível: vale até fechar a página
  }
  ouvintes.forEach((avisa) => avisa())
}

const assina = (avisa: () => void) => {
  ouvintes.add(avisa)
  return () => { ouvintes.delete(avisa) }
}

export const useRecomendacoes = (): Mapa => useSyncExternalStore(assina, () => recomendacoes)

export const textoRecomendacao = (r: Recomendacao): string =>
  `Minha recomendação: ${ROTULO_DECISAO[r.decisao].toLowerCase()}.${r.nota ? ` ${r.nota}` : ''}`
