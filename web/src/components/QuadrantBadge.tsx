/** Badge colorido por quadrante — cores do mockup do Joel. */

const QUADRANT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  Q1:  { bg: '#138a5b', text: '#fff', label: 'Expandir já' },
  Q2a: { bg: '#2b6cb0', text: '#fff', label: 'Expandir c/ alavancas' },
  Q2b: { bg: '#d9822b', text: '#fff', label: 'Satélite / grant' },
  Q3:  { bg: '#bf9000', text: '#fff', label: 'Comercial / M&A' },
  Q4:  { bg: '#8a94a3', text: '#fff', label: 'Monitorar' },
}

interface Props {
  quadrante: string
  showLabel?: boolean
}

export default function QuadrantBadge({ quadrante, showLabel = false }: Props) {
  const style = QUADRANT_STYLES[quadrante] ?? { bg: '#ccc', text: '#333', label: quadrante }
  return (
    <span
      style={{ background: style.bg, color: style.text }}
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: 'rgba(255,255,255,0.5)' }}
      />
      {quadrante}{showLabel && ` — ${style.label}`}
    </span>
  )
}
