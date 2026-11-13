/**
 * AiText — botão que gera um texto com o IBM Granite (backend /ia/*) e o exibe abaixo,
 * com "Copiar" para colar em e-mail, mensagem ou apresentação. O texto e o pedido em andamento
 * ficam na store: dá para sair da tela enquanto a IA pensa.
 */

import { useState } from 'react'
import { usePedidoIa } from '../hooks/usePedidoIa'

interface Props {
  label: string
  /** Identifica o pedido (o mesmo texto não é pedido duas vezes ao mesmo tempo). */
  chave: string
  /** Toast mostrado se a resposta chegar com o botão fora da tela. */
  aviso: string
  /** false quando o botão está montado mas escondido (ex.: ficha fechada). */
  visivel?: boolean
  run: () => Promise<string>
  disabled?: boolean
  /** Texto já gerado (guardado na store). */
  texto?: string
  onResult: (texto: string) => void
}

export default function AiText({ label, chave, aviso, visivel, run, disabled, texto: text, onResult }: Props) {
  const { gerando: loading, erro, pedir } = usePedidoIa(chave, aviso, visivel)
  const [erroCopia, setErroCopia] = useState<string>()
  const [copiado, setCopiado] = useState(false)
  const error = erroCopia ?? erro

  async function copiar() {
    try {
      await navigator.clipboard.writeText(text ?? '')
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErroCopia('Não foi possível copiar; selecione o texto e copie manualmente.')
    }
  }

  function go() {
    setErroCopia(undefined)
    pedir(async () => onResult(await run()))
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
          </small>{' '}
          <button
            type="button"
            className="no-print"
            onClick={copiar}
            style={{
              font: 'inherit', fontSize: 12, borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
              background: 'transparent', color: 'var(--tx)', border: '1px solid var(--ln)',
            }}
          >
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </div>
  )
}
