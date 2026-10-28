/**
 * MunView — tabela completa de municípios com filtros, ordenação,
 * favoritos e integração com o drawer.
 */

import { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useFavorites } from '../hooks/useFavorites'
import QuadrantBadge from '../components/QuadrantBadge'
import { QUADRANT_NAMES } from '../utils/constants'
import { fmtMi, fmtAnos, fmtN0 } from '../utils/format'
import { calcFinancial } from '../utils/calculation'
import type { Municipio } from '../api/client'

// ── Colunas ───────────────────────────────────────────────────────────────────

type SortKey = 'nome' | 'quadrante' | 'domicilios_urbanos' | 'matriculas_publicas' | 'capex' | 'payback' | 'portfolio'

const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'nome',               label: 'Município' },
  { key: 'quadrante',          label: 'Quadrante' },
  { key: 'domicilios_urbanos', label: 'Domicílios', numeric: true },
  { key: 'matriculas_publicas', label: 'Matrículas', numeric: true },
  { key: 'capex',              label: 'CapEx',     numeric: true },
  { key: 'payback',            label: 'Payback',   numeric: true },
  { key: 'portfolio',          label: 'Portfólio' },
]

const QUADRANT_OPTIONS = [
  { value: '',    label: 'Todos os quadrantes' },
  { value: 'Q1',  label: `Q1 — ${QUADRANT_NAMES['Q1']}` },
  { value: 'Q2a', label: `Q2a — ${QUADRANT_NAMES['Q2a']}` },
  { value: 'Q2b', label: `Q2b — ${QUADRANT_NAMES['Q2b']}` },
  { value: 'Q3',  label: `Q3 — ${QUADRANT_NAMES['Q3']}` },
  { value: 'Q4',  label: `Q4 — ${QUADRANT_NAMES['Q4']}` },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSortValue(m: Municipio, key: SortKey, capex: number, payback: number, isSel: boolean): string | number {
  switch (key) {
    case 'nome':                return m.nome
    case 'quadrante':           return m.quadrante
    case 'domicilios_urbanos':  return m.domicilios_urbanos ?? 0
    case 'matriculas_publicas': return m.matriculas_publicas ?? 0
    case 'capex':               return capex
    case 'payback':             return payback
    case 'portfolio':           return isSel ? 0 : 1
    default:                    return 0
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function MunView() {
  const municipios  = useAppStore((s) => s.municipios)
  const portfolio   = useAppStore((s) => s.portfolio)
  const levers      = useAppStore((s) => s.levers)
  const filters     = useAppStore((s) => s.filters)
  const setFilters  = useAppStore((s) => s.setFilters)
  const openDrawer  = useAppStore((s) => s.openDrawer)

  const [favs]              = useFavorites()
  const [sortKey, setSortKey] = useState<SortKey>('payback')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [portfolioOnly, setPortfolioOnly] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const portfolioIds = useMemo(
    () => new Set(portfolio.map((m) => m.id_municipio)),
    [portfolio]
  )

  // Calcula capex+payback por município (mock quando API offline)
  const calcMap = useMemo(() => {
    const map = new Map<string, { capex: number; payback: number }>()
    municipios.forEach((m) => {
      const r = calcFinancial(
        m.domicilios_urbanos ?? 5000,
        m.dist_backhaul_km ?? 50,
        m.escolas_sem_internet_aprendizagem ?? 0,
        m.acordo_migracao ?? false,
        levers,
      )
      map.set(m.id_municipio, { capex: r.capex, payback: r.pay })
    })
    return map
  }, [municipios, levers])

  // Filtra + ordena
  const rows = useMemo(() => {
    const search = filters.search.toLowerCase()
    const q      = filters.quadrante

    return municipios
      .filter((m) => {
        if (search && !m.nome.toLowerCase().includes(search)) return false
        if (q && m.quadrante !== q) return false
        if (portfolioOnly && !portfolioIds.has(m.id_municipio)) return false
        if (favoritesOnly && !favs.has(m.id_municipio)) return false
        return true
      })
      .sort((a, b) => {
        const ca = calcMap.get(a.id_municipio) ?? { capex: 0, payback: 99 }
        const cb = calcMap.get(b.id_municipio) ?? { capex: 0, payback: 99 }
        const va = getSortValue(a, sortKey, ca.capex, ca.payback, portfolioIds.has(a.id_municipio))
        const vb = getSortValue(b, sortKey, cb.capex, cb.payback, portfolioIds.has(b.id_municipio))
        if (typeof va === 'string') return va.localeCompare(vb as string) * sortDir
        return ((va as number) - (vb as number)) * sortDir
      })
  }, [municipios, filters, portfolioOnly, favoritesOnly, favs, portfolioIds, sortKey, sortDir, calcMap])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(1) }
  }

  const shown = rows.slice(0, 200)

  // ── Estilos compartilhados ────────────────────────────────────────────────

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

  const thStyle = (numeric?: boolean): React.CSSProperties => ({
    padding: '8px 10px',
    textAlign: numeric ? 'right' : 'left',
    borderBottom: '1px solid var(--ln)',
    fontWeight: 500,
    fontSize: 12,
    color: 'var(--mu)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  })

  const tdStyle = (numeric?: boolean): React.CSSProperties => ({
    padding: '8px 10px',
    textAlign: numeric ? 'right' : 'left',
    borderBottom: '1px solid var(--ln)',
    fontSize: 13,
  })

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 16 }}>
        <h1>Municípios</h1>
        <p style={{ color: 'var(--mu)' }}>
          Resultado do cenário atual. Clique em uma linha para abrir a ficha executiva.
        </p>
      </div>

      <div
        style={{
          background: 'var(--pn)',
          border: '1px solid var(--ln)',
          borderRadius: 6,
          padding: 16,
        }}
      >
        {/* Filtros */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Buscar município"
            aria-label="Buscar município"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            style={inputStyle}
          />

          <select
            aria-label="Filtrar por quadrante"
            value={filters.quadrante}
            onChange={(e) => setFilters({ quadrante: e.target.value })}
            style={inputStyle}
          >
            {QUADRANT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <label style={switchStyle(portfolioOnly)}>
            <input
              type="checkbox"
              checked={portfolioOnly}
              onChange={(e) => setPortfolioOnly(e.target.checked)}
              style={{ accentColor: 'var(--ac)', width: 16, height: 16, margin: 0, cursor: 'pointer' }}
            />
            Só portfólio
          </label>

          <label style={switchStyle(favoritesOnly)}>
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
              style={{ accentColor: 'var(--ac)', width: 16, height: 16, margin: 0, cursor: 'pointer' }}
            />
            Só favoritos
          </label>

          <span style={{ fontSize: 12, color: 'var(--mu)', marginLeft: 4 }}>
            Mostrando {shown.length} de {rows.length}
          </span>
        </div>

        {/* Tabela */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                {COLS.map((col) => {
                  const active = sortKey === col.key
                  return (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      aria-sort={active ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}
                      style={thStyle(col.numeric)}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--tx)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mu)')}
                    >
                      {col.label}
                      {active && <span style={{ marginLeft: 4 }}>{sortDir > 0 ? '▲' : '▼'}</span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLS.length}
                    style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--mu)', fontSize: 13 }}
                  >
                    Nenhum município encontrado. Ajuste a busca ou os filtros.
                  </td>
                </tr>
              ) : (
                shown.map((m) => {
                  const calc   = calcMap.get(m.id_municipio) ?? { capex: 0, payback: 99 }
                  const isSel  = portfolioIds.has(m.id_municipio)
                  const isFav  = favs.has(m.id_municipio)

                  return (
                    <tr
                      key={m.id_municipio}
                      tabIndex={0}
                      onClick={() => openDrawer(m.id_municipio)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openDrawer(m.id_municipio) }}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--so)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Nome */}
                      <td style={tdStyle()}>
                        {isFav && <span style={{ marginRight: 4 }}>★</span>}
                        <span style={{ fontWeight: 500 }}>{m.nome}</span>
                        <span style={{ color: 'var(--mu)', marginLeft: 6, fontSize: 12 }}>{m.uf}</span>
                      </td>

                      {/* Quadrante */}
                      <td style={tdStyle()}>
                        <QuadrantBadge quadrante={m.quadrante} showLabel={false} />
                        <span style={{ marginLeft: 6, fontSize: 12 }}>{m.quadrante}</span>
                      </td>

                      {/* Domicílios */}
                      <td style={tdStyle(true)}>{fmtN0(m.domicilios_urbanos)}</td>

                      {/* Matrículas */}
                      <td style={tdStyle(true)}>{fmtN0(m.matriculas_publicas)}</td>

                      {/* CapEx */}
                      <td style={tdStyle(true)}>{fmtMi(calc.capex)}</td>

                      {/* Payback */}
                      <td style={{ ...tdStyle(true), color: calc.payback <= 6 ? 'var(--ok)' : 'var(--tx)', fontWeight: calc.payback <= 6 ? 600 : 400 }}>
                        {fmtAnos(calc.payback)}
                      </td>

                      {/* Portfólio */}
                      <td style={{ ...tdStyle(), color: isSel ? 'var(--ok)' : 'var(--mu)', fontWeight: isSel ? 600 : 400 }}>
                        {isSel ? 'Selecionado' : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
