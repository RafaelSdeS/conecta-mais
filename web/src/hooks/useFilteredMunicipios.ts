/**
 * Filtro único de municípios (busca, UF, região, Semiárido, quadrante, portfólio, favoritos).
 * Mapa, tabela, contagem de quadrantes e histograma usam o mesmo resultado.
 */

import { useMemo } from 'react'
import type { Filters } from '../store/appStore'
import { aplicaFiltros } from '../utils/filtros'
import { useAppStore } from '../store/appStore'
import type { Municipio } from '../api/client'
import { useFavorites } from './useFavorites'

/** `ignorar` permite contar quadrantes sem aplicar o próprio filtro de quadrante. */
export function useFilteredMunicipios(ignorar?: keyof Filters): Municipio[] {
  const municipios = useAppStore((s) => s.municipios)
  const filters    = useAppStore((s) => s.filters)
  const portfolio  = useAppStore((s) => s.portfolio)
  const [favs]     = useFavorites()

  return useMemo(
    () => aplicaFiltros(municipios, filters, new Set(portfolio.map((m) => m.id_municipio)), favs, ignorar),
    [municipios, filters, portfolio, favs, ignorar],
  )
}
