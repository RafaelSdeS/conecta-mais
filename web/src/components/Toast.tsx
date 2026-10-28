/** Renderiza o toast mais recente (bottom center, animado). */

import { useToast } from '../hooks/useToast'

export default function Toast() {
  const { toasts } = useToast()
  const current = toasts[toasts.length - 1]

  if (!current) return null

  return (
    <div
      key={current.id}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translate(-50%, 0)',
        background: 'var(--tx)',
        color: 'var(--pn)',
        padding: '8px 14px',
        borderRadius: 6,
        fontSize: 13,
        zIndex: 70,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        animation: 'toast-in .2s ease forwards',
      }}
    >
      {current.message}
    </div>
  )
}
