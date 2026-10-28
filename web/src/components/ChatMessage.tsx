/**
 * ChatMessage — bolha de mensagem (usuário ou agente).
 */

interface Props {
  role:      'user' | 'agent'
  text?:     string   // HTML simples permitido apenas para role='agent'
  source?:   string
  isTyping?: boolean
}

export default function ChatMessage({ role, text, source, isTyping }: Props) {
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
          // Mensagem do usuário — escapar HTML
          <span>{text}</span>
        ) : (
          // Mensagem do agente — permite <b> e <br>
          <>
            <span dangerouslySetInnerHTML={{ __html: text ?? '' }} />
            {source && (
              <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: isUser ? 'rgba(255,255,255,.7)' : 'var(--mu)' }}>
                {source}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
