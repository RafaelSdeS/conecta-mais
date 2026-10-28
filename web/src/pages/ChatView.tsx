/**
 * ChatView — view do agente de justificativa.
 * Interface pronta; lógica isolada em chatService.ts para troca futura pela API do Chris.
 */

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import ChatMessage from '../components/ChatMessage'
import { getAnswer } from '../utils/chatService'
import { CHAT_CHIPS } from '../utils/constants'

interface Message {
  id:        number
  role:      'user' | 'agent'
  text?:     string
  source?:   string
  isTyping?: boolean
}

let nextId = 0

const INITIAL_MESSAGE: Message = {
  id:   nextId++,
  role: 'agent',
  text: 'Pergunte sobre um município, o portfólio, o FUST ou o Acordo TCU.',
}

export default function ChatView() {
  const municipios = useAppStore((s) => s.municipios)
  const portfolio  = useAppStore((s) => s.portfolio)
  const levers     = useAppStore((s) => s.levers)
  const budget     = useAppStore((s) => s.budget)

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  // Scroll automático para o final
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(question: string) {
    const q = question.trim()
    if (!q || loading) return

    const userMsg: Message = { id: nextId++, role: 'user', text: q }
    const typingMsg: Message = { id: nextId++, role: 'agent', isTyping: true }

    setMessages((prev) => [...prev, userMsg, typingMsg])
    setInput('')
    setLoading(true)

    try {
      const answer = await getAnswer(q, { municipios, portfolio, levers, budget })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMsg.id
            ? { ...m, isTyping: false, text: answer.text, source: answer.source }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMsg.id
            ? { ...m, isTyping: false, text: 'Erro ao obter resposta. Tente novamente.', source: '' }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 16 }}>
        <h1>Agente de justificativa</h1>
        <p style={{ color: 'var(--mu)' }}>
          Respostas com fonte e grau de confiança. Simulado: em produção usa watsonx.ai Granite e watsonx.governance.
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
        {/* Thread de mensagens */}
        <div
          style={{
            height: 400,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 10,
          }}
        >
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              text={msg.text}
              source={msg.source}
              isTyping={msg.isTyping}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Chips de sugestão */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {CHAT_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => send(chip)}
              disabled={loading}
              style={{
                font: 'inherit',
                fontSize: 12,
                background: 'var(--pn)',
                color: 'var(--mu)',
                border: '1px solid var(--ln)',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: loading ? 'default' : 'pointer',
                textAlign: 'left',
                opacity: loading ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.color = 'var(--tx)'; e.currentTarget.style.borderColor = 'var(--ac)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--mu)'; e.currentTarget.style.borderColor = 'var(--ln)' }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input) }}
            placeholder="Ex.: Por que priorizar o município X sobre o Y?"
            aria-label="Pergunta ao agente"
            disabled={loading}
            style={{
              flex: 1,
              font: 'inherit',
              fontSize: 13,
              background: 'var(--pn)',
              color: 'var(--tx)',
              border: '1px solid var(--ln)',
              borderRadius: 4,
              padding: '7px 10px',
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--ac)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--ln)')}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="btn-shimmer"
            style={{
              font: 'inherit',
              fontSize: 13,
              borderRadius: 4,
              padding: '7px 16px',
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              background: 'var(--ac)',
              color: 'var(--on)',
              border: '1px solid var(--ac)',
              opacity: loading || !input.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Aguarde…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
