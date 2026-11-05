/**
 * FilterBar — filtros únicos (busca, UF, região, Semiárido, quadrante, decisão, portfólio, favoritos).
 * Painel e Municípios usam a mesma barra; mapa, tabela e contagens leem o mesmo estado.
 * A UF, a região e o Semiárido também delimitam o portfólio calculado no backend.
 */

import { useAppStore, type Filters } from '../store/appStore'
import { DECISOES, QUADRANT_NAMES, UFS } from '../utils/constants'
import { REGIOES } from '../utils/regioes'

const inputStyle: React.CSSProperties = {
  font: 'inherit',
  fontSize: 13,
  background: 'var(--pn)',
  color: 'var(--tx)',
  border: '1px solid var(--ln)',
  borderRadius: 4,
  padding: '6px 10px',
}

const switchStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: `1px solid ${active ? 'var(--ac)' : 'var(--ln)'}`,
  borderRadius: 4,
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: 13,
  background: active ? 'var(--so)' : 'transparent',
  userSelect: 'none',
})

interface Props {
  /** Texto "Mostrando X de Y" (opcional). */
  resumo?: string
}

export default function FilterBar({ resumo }: Props) {
  const filters      = useAppStore((s) => s.filters)
  const setFilters   = useAppStore((s) => s.setFilters)
  const clearFilters = useAppStore((s) => s.clearFilters)

  const ativo = Object.values(filters).some((v) => v !== '' && v !== false)

  const check = (key: 'semiarido' | 'portfolioOnly' | 'favoritesOnly', label: string, title?: string) => (
    <label style={switchStyle(filters[key])} title={title}>
      <input
        type="checkbox"
        checked={filters[key]}
        onChange={(e) => setFilters({ [key]: e.target.checked })}
        style={{ accentColor: 'var(--ac)', width: 16, height: 16, margin: 0, cursor: 'pointer' }}
      />
      {label}
    </label>
  )

  return (
    <div
      role="search"
      aria-label="Filtros de municípios"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}
    >
      <input
        type="search"
        placeholder="Buscar município"
        aria-label="Buscar município"
        value={filters.search}
        onChange={(e) => setFilters({ search: e.target.value })}
        style={inputStyle}
      />

      <select
        aria-label="Filtrar por UF"
        value={filters.uf}
        onChange={(e) => setFilters({ uf: e.target.value })}
        style={inputStyle}
      >
        <option value="">Todas as UFs</option>
        {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>

      <select
        aria-label="Filtrar por região"
        value={filters.regiao}
        onChange={(e) => setFilters({ regiao: e.target.value })}
        style={inputStyle}
      >
        <option value="">Todas as regiões</option>
        {REGIOES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      <select
        aria-label="Filtrar por quadrante"
        value={filters.quadrante}
        onChange={(e) => setFilters({ quadrante: e.target.value })}
        style={inputStyle}
      >
        <option value="">Todos os quadrantes</option>
        {Object.entries(QUADRANT_NAMES).map(([q, nome]) => (
          <option key={q} value={q}>{q} · {nome}</option>
        ))}
      </select>

      <select
        aria-label="Filtrar por decisão"
        value={filters.decisao}
        onChange={(e) => setFilters({ decisao: e.target.value as Filters['decisao'] })}
        style={inputStyle}
      >
        <option value="">Todas as decisões</option>
        {Object.entries(DECISOES).map(([d, { label }]) => <option key={d} value={d}>{label}s</option>)}
        <option value="pendente">Sem decisão</option>
      </select>

      {check('semiarido', 'Semiárido', 'Municípios da delimitação oficial do Semiárido (IBGE/SUDENE 2022)')}
      {check('portfolioOnly', 'Só portfólio')}
      {check('favoritesOnly', 'Só favoritos')}

      {ativo && (
        <button
          type="button"
          onClick={clearFilters}
          style={{ ...inputStyle, cursor: 'pointer', color: 'var(--mu)' }}
        >
          Limpar filtros
        </button>
      )}
      {resumo && <span style={{ fontSize: 12, color: 'var(--mu)', marginLeft: 4 }}>{resumo}</span>}
    </div>
  )
}
