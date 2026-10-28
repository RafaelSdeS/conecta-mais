/**
 * PaybackHistogram — 12 barras de payback (0–12+ anos).
 * Verde: até 6 anos. Cinza: 6+ anos.
 */

import type { Municipio } from '../api/client'

interface Props {
  municipios: Municipio[]
  /** Payback por município — vem do portfólio result ou calculado localmente */
  paybacks: number[]
}

export default function PaybackHistogram({ paybacks }: Props) {
  // 12 buckets: 0–1, 1–2, ..., 11–12+
  const buckets = Array(12).fill(0)
  paybacks.forEach((p) => {
    const i = Math.min(11, Math.floor(Math.max(0, p)))
    buckets[i]++
  })
  const max = Math.max(...buckets, 1)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 90,
          margin: '6px 0 2px',
        }}
      >
        {buckets.map((n, i) => (
          <div
            key={i}
            title={`${i}–${i + 1} anos: ${n} municípios`}
            style={{
              flex: 1,
              borderRadius: '2px 2px 0 0',
              minHeight: 2,
              height: `${(n / max) * 100}%`,
              background: i < 6 ? 'var(--q1)' : 'var(--q4)',
              transition: 'height .3s',
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--mu)',
        }}
      >
        <span>0</span>
        <span>6 anos</span>
        <span>12+</span>
      </div>
    </div>
  )
}
