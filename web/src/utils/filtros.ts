/** Filtro puro dos municípios (sem React), compartilhado por mapa, tabela e contagens. */

import type { Municipio } from '../api/client'
import type { Filters } from '../store/appStore'
import { regiaoDe } from './regioes'

/** Quem digita no celular costuma omitir acentos. */
export const semAcento = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const CHAVE_UF = 'cm_uf'

/** UF da região do gestor, lembrada entre visitas; sem armazenamento disponível, começa em branco. */
export function ufSalva(): string {
  try {
    return localStorage.getItem(CHAVE_UF) ?? ''
  } catch {
    return ''
  }
}

export function salvaUf(uf: string): void {
  try {
    localStorage.setItem(CHAVE_UF, uf)
  } catch {
    // armazenamento indisponível: a escolha vale só nesta visita
  }
}

export function aplicaFiltros(
  municipios: Municipio[],
  f: Filters,
  portfolioIds: Set<string>,
  favs: Set<string>,
  ignorar?: keyof Filters,
): Municipio[] {
  const busca = semAcento(f.search.trim())
  return municipios.filter((m) => {
    if (ignorar !== 'search' && busca && !semAcento(m.nome).includes(busca)) return false
    if (ignorar !== 'uf' && f.uf && m.uf !== f.uf) return false
    if (ignorar !== 'regiao' && f.regiao && regiaoDe(m.id_municipio) !== f.regiao) return false
    if (ignorar !== 'semiarido' && f.semiarido && !m.semiarido) return false
    if (ignorar !== 'quadrante' && f.quadrante && m.quadrante !== f.quadrante) return false
    if (ignorar !== 'portfolioOnly' && f.portfolioOnly && !portfolioIds.has(m.id_municipio)) return false
    if (ignorar !== 'favoritesOnly' && f.favoritesOnly && !favs.has(m.id_municipio)) return false
    return true
  })
}
