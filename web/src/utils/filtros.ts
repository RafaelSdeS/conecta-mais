/** Filtro puro dos municípios (sem React), compartilhado por mapa, tabela e contagens. */

import type { Municipio } from '../api/client'
import type { Filters } from '../store/appStore'
import { regiaoDe } from './regioes'

export function aplicaFiltros(
  municipios: Municipio[],
  f: Filters,
  portfolioIds: Set<string>,
  favs: Set<string>,
  ignorar?: keyof Filters,
): Municipio[] {
  const busca = f.search.trim().toLowerCase()
  return municipios.filter((m) => {
    if (ignorar !== 'search' && busca && !m.nome.toLowerCase().includes(busca)) return false
    if (ignorar !== 'uf' && f.uf && m.uf !== f.uf) return false
    if (ignorar !== 'regiao' && f.regiao && regiaoDe(m.id_municipio) !== f.regiao) return false
    if (ignorar !== 'semiarido' && f.semiarido && !m.semiarido) return false
    if (ignorar !== 'quadrante' && f.quadrante && m.quadrante !== f.quadrante) return false
    if (ignorar !== 'portfolioOnly' && f.portfolioOnly && !portfolioIds.has(m.id_municipio)) return false
    if (ignorar !== 'favoritesOnly' && f.favoritesOnly && !favs.has(m.id_municipio)) return false
    return true
  })
}
