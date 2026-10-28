/**
 * QuadrantButtons — 5 botões seletores de quadrante com contagem e barra de proporção.
 * Clicar num quadrante filtra o mapa e a tabela; clicar novamente desfaz o filtro.
 */

import { useAppStore } from '../store/appStore'
import { QUADRANT_NAMES, QUADRANT_CSS_VARS } from '../utils/constants'
import type { Municipio } from '../api/client'

const QUADRANTS = ['Q1', 'Q2a', 'Q2b', 'Q3', 'Q4']

interface Props {
  municipios: Municipio[]
}

export default function QuadrantButtons({ municipios }: Props) {
  const filters    = useAppStore((s) => s.filters)
  const setFilters = useAppStore((s) => s.setFilters)

  // Conta municípios por quadrante
  const counts = QUADRANTS.reduce<Record<string, number>>((acc, q) => {
    acc[q] = municipios.filter((m) => m.quadrante === q).length
    return acc
  }, {})

  const total = municipios.length || 1

  function handleClick(q: string) {
    setFilters({ quadrante: filters.quadrante === q ? '' : q })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {QUADRANTS.map((q) => {
        const active = filters.quadrante === q
        const color  = QUADRANT_CSS_VARS[q]
        const count  = counts[q] ?? 0
        const pct    = (count / total) * 100

        return (
          <button
            key={q}
            onClick={() => handleClick(q)}
            style={{
              display: 'grid',
              gridTemplateColumns: '14px 1fr auto',
              gap: '2px 8px',
              width: '100%',
              font: 'inherit',
              fontSize: 13,
              color: 'inherit',
              textAlign: 'left',
              background: active ? 'var(--so)' : 'none',
              border: `1px solid ${active ? 'var(--ac)' : 'transparent'}`,
              borderRadius: 4,
              padding: '7px 8px',
              cursor: 'pointer',
              alignItems: 'center',
            }}
          >
            {/* Dot */}
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            {/* Label */}
            <span>
              {q} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>{QUADRANT_NAMES[q]}</span>
            </span>
            {/* Count */}
            <b>{count}</b>
            {/* Bar — spans full width */}
            <span
              style={{
                gridColumn: '2 / 4',
                display: 'block',
                height: 4,
                background: color,
                borderRadius: 2,
                opacity: 0.7,
                width: `${pct}%`,
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
