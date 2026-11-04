/**
 * Hook para persistir favoritos no localStorage.
 * Retorna [favSet, toggleFav] — sincronizado com a chave 'cm_fav'.
 */

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'cm_fav'

function loadFavs(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(JSON.parse(raw ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveFavs(favs: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]))
  } catch {
    // localStorage indisponível (ex.: iframe sandboxed)
  }
}

// Estado compartilhado: ficha, tabela e filtro enxergam o mesmo conjunto de favoritos.
let favoritos = loadFavs()
const ouvintes = new Set<() => void>()

function toggleGlobal(id: string) {
  const next = new Set(favoritos)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  favoritos = next
  saveFavs(next)
  ouvintes.forEach((l) => l())
}

function subscribe(listener: () => void) {
  ouvintes.add(listener)
  return () => { ouvintes.delete(listener) }
}

export function useFavorites() {
  const favs = useSyncExternalStore(subscribe, () => favoritos)
  return [favs, toggleGlobal] as const
}
