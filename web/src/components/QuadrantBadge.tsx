/** Badge colorido de quadrante — usa CSS vars do design system. */

import { QUADRANT_CSS_VARS, QUADRANT_NAMES } from '../utils/constants'

interface Props {
  quadrante: string
  showLabel?: boolean
}

export default function QuadrantBadge({ quadrante, showLabel = true }: Props) {
  const color = QUADRANT_CSS_VARS[quadrante] ?? 'var(--q4)'
  const label = QUADRANT_NAMES[quadrante] ?? quadrante

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
      }}
    >
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
      {showLabel ? (
        <span>{quadrante} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>{label}</span></span>
      ) : (
        <span>{quadrante}</span>
      )}
    </span>
  )
}
