/**
 * ChatView — conversa com o agente Granite pelo backend FastAPI.
 * A conversa fica no chatStore: sair desta tela não perde mensagens nem a resposta em andamento.
 */

import { useEffect, useRef, useState } from 'react'
import ChatMessage from '../components/ChatMessage'
import type { Acao } from '../api/client'
import { useChatStore } from '../store/chatStore'
import { useToast } from '../hooks/toastContext'
import { aplicarAcao } from '../utils/acoes'
import { CHAT_CHIPS } from '../utils/constants'

export default function ChatView() {
  const messages   = useChatStore((s) => s.messages)
  const loading    = useChatStore((s) => s.loading)
  const enviar     = useChatStore((s) => s.enviar)
  const marcarLida = useChatStore((s) => s.marcarLida)
  const limpar     = useChatStore((s) => s.limpar)
  const conversou  = useChatStore((s) => s.messages.length > 1)
  const [input, setInput] = useState('')
  const bottomRef         = useRef<HTMLDivElement>(null)
  const { toast }         = useToast()

  function aplicar(acao: Acao) {
    aplicarAcao(acao)
    toast(acao.tipo === 'aplicar_cenario' ? 'Cenário aplicado no painel' : acao.rotulo)
  }

  // Ao abrir a tela, a resposta que chegou em outra tela deixa de contar como nova.
  useEffect(() => { marcarLida() }, [marcarLida, messages])

  // Scroll automático para o final
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send(question: string) {
    if (!question.trim() || loading) return
    setInput('')
    void enviar(question)
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>Agente de justificativa</h1>
          <p style={{ color: 'var(--mu)' }}>
            Consulte dados reais, resultados demonstrativos e documentação técnica com referências.
          </p>
        </div>
        {/* Desabilitado com resposta a caminho: ela gravaria o histórico numa conversa já limpa. */}
        <button
          type="button"
          onClick={limpar}
          disabled={loading || !conversou}
          title={loading ? 'Aguarde a resposta do agente' : undefined}
          style={{
            font: 'inherit', fontSize: 13, borderRadius: 4, padding: '8px 12px',
            cursor: loading || !conversou ? 'default' : 'pointer', background: 'transparent',
            color: 'var(--tx)', border: '1px solid var(--ln)', opacity: loading || !conversou ? 0.5 : 1,
          }}
        >
          Nova conversa
        </button>
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
              sources={msg.sources}
              references={msg.references}
              hasDemoData={msg.hasDemoData}
              error={msg.error}
              isTyping={msg.isTyping}
              actions={msg.actions}
              onAction={aplicar}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
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
