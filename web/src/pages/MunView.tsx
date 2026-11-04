/**
 * MunView — tabela de municípios do cenário atual, com filtros compartilhados,
 * ordenação, favoritos e integração com a ficha. CapEx, payback e VPL vêm do backend.
 */

import { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useFavorites } from '../hooks/useFavorites'
import { useFilteredMunicipios } from '../hooks/useFilteredMunicipios'
import FilterBar from '../components/FilterBar'
import QuadrantBadge from '../components/QuadrantBadge'
import { fmtMi, fmtAnos, fmtN0 } from '../utils/format'
import type { FinanceiroLinha, Municipio } from '../api/client'

// ── Colunas ───────────────────────────────────────────────────────────────────

type SortKey = 'nome' | 'quadrante' | 'domicilios_urbanos' | 'alunos_sem_internet' | 'capex' | 'payback' | 'vpl' | 'portfolio'

const COLS: { key: SortKey; label: string; numeric?: boolean; title?: string }[] = [
  { key: 'nome',                label: 'Município' },
  { key: 'quadrante',           label: 'Quadrante' },
  { key: 'domicilios_urbanos',  label: 'Domicílios', numeric: true },
  { key: 'alunos_sem_internet', label: 'Alunos s/ internet', numeric: true, title: 'Matrículas em escolas sem internet para aprendizagem' },
  { key: 'capex',               label: 'CapEx', numeric: true },
  { key: 'payback',             label: 'Payback', numeric: true },
  { key: 'vpl',                 label: 'VPL', numeric: true, title: 'Valor presente líquido no cenário atual (R$ mi)' },
  { key: 'portfolio',           label: 'Portfólio' },
]

const SEM_FIN: FinanceiroLinha = { id_municipio: '', capex: NaN, payback: null, npv: NaN }

function getSortValue(m: Municipio, key: SortKey, f: FinanceiroLinha, isSel: boolean): string | number {
  switch (key) {
    case 'nome':                return m.nome
    case 'quadrante':           return m.quadrante
    case 'domicilios_urbanos':  return m.domicilios_urbanos ?? 0
    case 'alunos_sem_internet': return m.alunos_sem_internet ?? 0
    case 'capex':               return Number.isFinite(f.capex) ? f.capex : Infinity
    case 'payback':             return f.payback ?? Infinity
    case 'vpl':                 return Number.isFinite(f.npv) ? f.npv : -Infinity
    case 'portfolio':           return isSel ? 0 : 1
  }
}

// ── Estilos ───────────────────────────────────────────────────────────────────

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

// ── Componente ────────────────────────────────────────────────────────────────

export default function MunView() {
  const portfolio   = useAppStore((s) => s.portfolio)
  const financeiro  = useAppStore((s) => s.financeiro)
  const openDrawer  = useAppStore((s) => s.openDrawer)
  const setHovered  = useAppStore((s) => s.setHovered)
  const filtrados   = useFilteredMunicipios()

  const [favs]                = useFavorites()
  const [sortKey, setSortKey] = useState<SortKey>('payback')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const portfolioIds = useMemo(() => new Set(portfolio.map((m) => m.id_municipio)), [portfolio])

  const rows = useMemo(
    () =>
      [...filtrados].sort((a, b) => {
        const va = getSortValue(a, sortKey, financeiro[a.id_municipio] ?? SEM_FIN, portfolioIds.has(a.id_municipio))
        const vb = getSortValue(b, sortKey, financeiro[b.id_municipio] ?? SEM_FIN, portfolioIds.has(b.id_municipio))
        if (typeof va === 'string') return va.localeCompare(vb as string) * sortDir
        return ((va as number) - (vb as number)) * sortDir
      }),
    [filtrados, financeiro, portfolioIds, sortKey, sortDir],
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(1) }
  }

  const shown = rows.slice(0, 200)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1>Municípios</h1>
        <p style={{ color: 'var(--mu)' }}>
          Resultado do cenário atual (orçamento, alavancas e premissas do topo). Clique em uma linha para abrir a ficha executiva.
        </p>
      </div>

      <div style={{ background: 'var(--pn)', border: '1px solid var(--ln)', borderRadius: 6, padding: 16 }}>
        <FilterBar resumo={`Mostrando ${shown.length} de ${rows.length}`} />

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {COLS.map((col) => {
                  const active = sortKey === col.key
                  return (
                    <th
                      key={col.key}
                      title={col.title}
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
            <tbody onMouseLeave={() => setHovered(null)}>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--mu)', fontSize: 13 }}>
                    Nenhum município encontrado. Ajuste a busca ou os filtros.
                  </td>
                </tr>
              ) : (
                shown.map((m) => {
                  const f     = financeiro[m.id_municipio]
                  const isSel = portfolioIds.has(m.id_municipio)
                  const isFav = favs.has(m.id_municipio)
                  const pay   = f?.payback ?? null

                  return (
                    <tr
                      key={m.id_municipio}
                      tabIndex={0}
                      onClick={() => openDrawer(m.id_municipio)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openDrawer(m.id_municipio) }}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--so)'; setHovered(m.id_municipio) }}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={tdStyle()}>
                        {isFav && <span style={{ marginRight: 4 }}>★</span>}
                        <span style={{ fontWeight: 500 }}>{m.nome}</span>
                        <span style={{ color: 'var(--mu)', marginLeft: 6, fontSize: 12 }}>{m.uf}</span>
                      </td>
                      <td style={tdStyle()}>
                        <QuadrantBadge quadrante={m.quadrante} showLabel={false} />
                        <span style={{ marginLeft: 6, fontSize: 12 }}>{m.quadrante}</span>
                      </td>
                      <td style={tdStyle(true)}>{fmtN0(m.domicilios_urbanos)}</td>
                      <td style={tdStyle(true)}>{fmtN0(m.alunos_sem_internet)}</td>
                      <td style={tdStyle(true)}>{f ? fmtMi(f.capex) : '—'}</td>
                      <td style={{ ...tdStyle(true), color: pay !== null && pay <= 6 ? 'var(--ok)' : 'var(--tx)', fontWeight: pay !== null && pay <= 6 ? 600 : 400 }}>
                        {f ? fmtAnos(pay) : '—'}
                      </td>
                      <td style={{ ...tdStyle(true), color: f && f.npv >= 0 ? 'var(--ok)' : 'var(--tx)' }}>
                        {f ? fmtMi(f.npv) : '—'}
                      </td>
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
