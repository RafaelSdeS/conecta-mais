/**
 * KPICard — card individual de indicador com valor animado.
 */

import { useAnimatedValue } from '../hooks/useAnimatedValue'

interface Props {
  label: string
  value: number
  format: (v: number) => string
  detail: string
}

export default function KPICard({ label, value, format, detail }: Props) {
  const animated = useAnimatedValue(value)

  return (
    <div
      style={{
        background: 'var(--pn)',
        border: '1px solid var(--ln)',
        borderRadius: 6,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--mu)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>{format(animated)}</div>
      <div style={{ fontSize: 12, color: 'var(--mu)' }}>{detail}</div>
    </div>
  )
}
