/**
 * AiText — botão que gera um texto com o IBM Granite (backend /ia/*) e o exibe abaixo.
 */

import { useState } from 'react'

interface Props {
  label: string
  run: () => Promise<string>
  disabled?: boolean
  /** Texto já gerado antes (ex.: guardado na store) para reexibir sem nova chamada. */
  initial?: string
  onResult?: (texto: string) => void
}

export default function AiText({ label, run, disabled, initial, onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | undefined>(initial)
  const [error, setError] = useState<string>()

  async function go() {
    setLoading(true)
    setError(undefined)
    try {
      const texto = await run()
      setText(texto)
      onResult?.(texto)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ margin: '12px 0' }}>
      <button
        type="button"
        className="no-print"
        onClick={go}
        disabled={disabled || loading}
        style={{
          font: 'inherit',
          fontSize: 13,
          borderRadius: 4,
          padding: '5px 10px',
          cursor: disabled || loading ? 'default' : 'pointer',
          background: 'transparent',
          color: 'var(--tx)',
          border: '1px solid var(--ac)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {loading ? 'Gerando…' : `✦ ${label}`}
      </button>
      {error && (
        <p role="alert" style={{ color: 'var(--q2b)', fontSize: 12, margin: '8px 0 0' }}>
          {error}
        </p>
      )}
      {text && (
        <div aria-live="polite" style={{ marginTop: 8 }}>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{text}</p>
          <small style={{ color: 'var(--mu)' }}>
            Texto gerado por IBM Granite (watsonx.ai) a partir dos dados do motor. Revise antes de decidir.
          </small>
        </div>
      )}
    </div>
  )
}
