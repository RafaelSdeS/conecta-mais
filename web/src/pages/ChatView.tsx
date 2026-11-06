/**
 * ChatView — conversa com o agente Granite pelo backend FastAPI.
 */

import { useEffect, useRef, useState } from 'react'
import ChatMessage from '../components/ChatMessage'
import type { Acao } from '../api/client'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/toastContext'
import { aplicarAcao } from '../utils/acoes'
import {
  ChatServiceError,
  getAnswer,
  type ChatDataSource,
  type ChatHistoryMessage,
  type RagReference,
} from '../utils/chatService'
import { CHAT_CHIPS } from '../utils/constants'

interface Message {
  id:        number
  role:      'user' | 'agent'
  text:      string
  sources?:  ChatDataSource[]
  references?: RagReference[]
  hasDemoData?: boolean
  error?:    string
  isTyping?: boolean
  actions?:  Acao[]
}

let nextId = 0

const INITIAL_MESSAGE: Message = {
  id:   nextId++,
  role: 'agent',
  text: 'Pergunte por rankings de municípios, portfólio para um orçamento, comparação entre cidades, escolas sem internet ou o significado dos scores e quadrantes.',
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [history, setHistory] = useState<ChatHistoryMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const { toast }               = useToast()

  function aplicar(acao: Acao) {
    aplicarAcao(acao)
    toast(acao.tipo === 'aplicar_cenario' ? 'Cenário aplicado no painel' : acao.rotulo)
  }

  // Scroll automático para o final
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(question: string) {
    const q = question.trim()
    if (!q || loading) return

    const userMsg: Message = { id: nextId++, role: 'user', text: q }
    const typingMsg: Message = {
      id: nextId++,
      role: 'agent',
      text: '',
      isTyping: true,
    }

    setMessages((prev) => [...prev, userMsg, typingMsg])
    setInput('')
    setLoading(true)

    try {
      const { selectedId, municipios, budget, filters, levers, params, objetivo } = useAppStore.getState()
      const selecionado = municipios.find((m) => m.id_municipio === selectedId)
      const answer = await getAnswer(q, history, {
        ...(selecionado ? { municipio_id: selecionado.id_municipio, municipio_nome: selecionado.nome } : {}),
        orcamento_mi: budget,
        ...(filters.quadrante ? { quadrante: filters.quadrante } : {}),
        ...(filters.search ? { busca: filters.search } : {}),
        ...(filters.uf ? { uf: filters.uf } : {}),
        ...(filters.regiao ? { regiao: filters.regiao } : {}),
        ...(filters.semiarido ? { semiarido: true } : {}),
        objetivo,
        alavancas: {
          backhaul_comprometido: levers.tcu,
          fust_reembolsavel:     levers.fust,
          receita_escolar:       levers.enec,
        },
        premissas: { ...params },
      })
      setHistory(answer.history)

      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMsg.id
            ? {
                ...m,
                isTyping: false,
                text: answer.text,
                sources: answer.sources,
                references: answer.references,
                hasDemoData: answer.hasDemoData,
                actions: answer.actions,
              }
            : m
        )
      )
    } catch (error) {
      const serviceError =
        error instanceof ChatServiceError
          ? error
          : new ChatServiceError(
              'Não foi possível obter resposta do backend Conecta+.',
            )
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingMsg.id
            ? {
                ...m,
                isTyping: false,
                text: serviceError.partialResponse ?? '',
                sources: serviceError.dataSources,
                hasDemoData: serviceError.hasDemoData,
                error: serviceError.message,
              }
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
          Consulte dados reais, resultados demonstrativos e documentação técnica com referências.
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
