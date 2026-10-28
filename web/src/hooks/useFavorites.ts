/**
 * Hook para persistir favoritos no localStorage.
 * Retorna [favSet, toggleFav] — sincronizado com a chave 'cm_fav'.
 */

import { useCallback, useState } from 'react'

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

export function useFavorites() {
  const [favs, setFavs] = useState<Set<string>>(loadFavs)

  const toggle = useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavs(next)
      return next
    })
  }, [])

  return [favs, toggle] as const
}
