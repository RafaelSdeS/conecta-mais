/**
 * ChatMessage — bolha de mensagem (usuário ou agente).
 */

import type { ReactNode } from 'react'
import type { ChatDataSource, RagReference } from '../utils/chatService'

interface Props {
  role:      'user' | 'agent'
  text:      string
  sources?:  ChatDataSource[]
  references?: RagReference[]
  hasDemoData?: boolean
  error?:    string
  isTyping?: boolean
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function renderText(text: string): ReactNode[] {
  return text.split('\n').map((line, index) => (
    <span key={index}>
      {index > 0 && <br />}
      {renderInline(line)}
    </span>
  ))
}

const SOURCE_LABELS: Record<ChatDataSource['id'], string> = {
  sqlite_integrado: 'Dados reais · SQLite integrado',
  engine_mock: 'Resultado demonstrativo · motor Conecta+',
  rag_tecnico: 'Documentação interna · RAG técnico (não oficial)',
}

export default function ChatMessage({
  role,
  text,
  sources = [],
  references = [],
  hasDemoData = false,
  error,
  isTyping,
}: Props) {
  const isUser = role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '9px 12px',
          borderRadius: 6,
          fontSize: 13,
          background: isUser ? 'var(--ac)' : 'var(--so)',
          color: isUser ? 'var(--on)' : 'var(--tx)',
          border: isUser ? 'none' : '1px solid var(--ln)',
        }}
      >
        {isTyping ? (
          // Indicador de digitação
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        ) : isUser ? (
          <span>{renderText(text)}</span>
        ) : (
          <>
            {text && <span>{renderText(text)}</span>}
            {hasDemoData && (
              <span
                role="note"
                style={{
                  display: 'block',
                  marginTop: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: 'rgba(217, 130, 43, .12)',
                  color: 'var(--tx)',
                }}
              >
                Resultado demonstrativo; não representa dado real nem recomendação.
              </span>
            )}
            {error && (
              <span
                role="alert"
                style={{ display: 'block', marginTop: 8, color: 'var(--er, #b42318)' }}
              >
                {error}
              </span>
            )}
            {sources.length > 0 && (
              <div
                aria-label="Fontes utilizadas"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 5,
                  marginTop: 8,
                }}
              >
                {sources.map((item) => (
                  <span
                    key={item.id}
                    title={item.descricao}
                    style={{
                      fontSize: 10,
                      border: '1px solid var(--ln)',
                      borderRadius: 999,
                      padding: '2px 7px',
                      color: 'var(--mu)',
                    }}
                  >
                    {SOURCE_LABELS[item.id]}
                  </span>
                ))}
              </div>
            )}
            {references.length > 0 && (
              <div
                aria-label="Referências documentais"
                style={{
                  marginTop: 8,
                  paddingTop: 7,
                  borderTop: '1px solid var(--ln)',
                  fontSize: 11,
                  color: 'var(--mu)',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 4 }}>
                  Referências documentais
                </strong>
                {references.map((reference, index) => (
                  <div key={`${reference.sourcePath}-${reference.lines}-${index}`}>
                    {reference.title} — {reference.sourcePath}, {reference.section}
                    {` (linhas ${reference.lines}) — `}
                    {reference.isOfficial
                      ? 'fonte oficial'
                      : 'fonte interna, não oficial'}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
