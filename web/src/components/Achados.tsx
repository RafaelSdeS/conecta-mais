/**
 * Achados — o motor procura no cenário o que pode ter passado despercebido (orçamento um pouco
 * maior, alavancas desligadas, municípios fora do plano com mais alunos por real, decisões que o
 * plano contradiz); o IBM Granite escolhe até 3 e os redige. Cada cartão traz uma ação de um clique.
 */

import { useState } from 'react'
import { api, type Achado } from '../api/client'
import { cenarioDaTela } from '../hooks/usePortfolioTrigger'
import { useToast } from '../hooks/toastContext'
import { useAppStore } from '../store/appStore'
import { aplicarAcao } from '../utils/acoes'

const botao: React.CSSProperties = {
  font: 'inherit', fontSize: 13, borderRadius: 4, padding: '5px 10px', cursor: 'pointer',
  background: 'transparent', color: 'var(--tx)', border: '1px solid var(--ac)',
}

export default function Achados({ chave, disabled }: { chave: string; disabled?: boolean }) {
  // Guardados no store por cenário: voltar ao painel não perde os cartões nem gasta outra chamada.
  const guardados = useAppStore((s) => (s.achados?.chave === chave ? s.achados.cartoes : null))
  const setAchados = useAppStore((s) => s.setAchados)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const { toast } = useToast()

  async function gerar() {
    setLoading(true)
    setError(undefined)
    try {
      setAchados({ chave, cartoes: (await api.postAchados(cenarioDaTela(useAppStore.getState()))).cartoes })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function aplicar(a: Achado) {
    aplicarAcao(a.acao)
    toast(a.acao.tipo === 'aplicar_cenario' ? `Cenário atualizado: ${a.acao.rotulo}` : a.acao.rotulo)
  }

  return (
    <div className="no-print" style={{ margin: '12px 0' }}>
      <button type="button" onClick={gerar} disabled={disabled || loading} style={{ ...botao, opacity: disabled ? 0.5 : 1 }}>
        {loading ? 'Procurando…' : '✦ O que eu não estou vendo?'}
      </button>
      {error && <p role="alert" style={{ color: 'var(--q2b)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
      {guardados && guardados.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--mu)', margin: '8px 0 0' }}>Nada fora do comum neste cenário.</p>
      )}
      {guardados && guardados.length > 0 && (
        <div aria-live="polite" style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {guardados.map((c) => (
              <article key={c.id} style={{ border: '1px solid var(--ln)', borderRadius: 6, padding: 10, background: 'var(--pn)' }}>
                <b style={{ fontSize: 13 }}>{c.titulo}</b>
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: '4px 0 8px' }}>{c.texto}</p>
                <button type="button" onClick={() => aplicar(c)} style={{ ...botao, fontSize: 12, border: '1px solid var(--ln)' }}>
                  {c.acao.rotulo}
                </button>
              </article>
            ))}
          </div>
          <small style={{ color: 'var(--mu)' }}>
            Achados calculados pelo motor e redigidos por IBM Granite (watsonx.ai). Revise antes de decidir.
          </small>
        </div>
      )}
    </div>
  )
}
