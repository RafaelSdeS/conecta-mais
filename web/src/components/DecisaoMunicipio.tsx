/**
 * DecisaoMunicipio — decisão vigente do gestor, registro de uma nova decisão e histórico.
 * O servidor guarda o cenário e recalcula os números; nada é apagado (a mais recente vale).
 * Só a decisão vigente sai no PDF da ficha.
 */

import { useState } from 'react'
import { api, type Decisao, type Municipio, type TipoDecisao } from '../api/client'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/toastContext'
import { cenarioDaTela } from '../hooks/usePortfolioTrigger'
import { DECISOES } from '../utils/constants'
import { fmtAnos, fmtMi } from '../utils/format'
import type { StatusPlano } from '../utils/plano'

const CHAVE_RESPONSAVEL = 'cm_responsavel'

function lerResponsavel(): string {
  try { return localStorage.getItem(CHAVE_RESPONSAVEL) ?? '' } catch { return '' }
}
function guardarResponsavel(nome: string) {
  try { localStorage.setItem(CHAVE_RESPONSAVEL, nome) } catch { /* armazenamento indisponível */ }
}

const campo: React.CSSProperties = {
  font: 'inherit', fontSize: 14, width: '100%', boxSizing: 'border-box', background: 'var(--pn)',
  color: 'var(--tx)', border: '1px solid var(--ln)', borderRadius: 4, padding: '8px 10px',
}
const botao: React.CSSProperties = {
  font: 'inherit', fontSize: 13, borderRadius: 4, padding: '8px 12px', cursor: 'pointer',
  background: 'transparent', color: 'var(--tx)', border: '1px solid var(--ln)',
}
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function Registro({ d }: { d: Decisao }) {
  const n = d.numeros
  return (
    <div style={{ fontSize: 13 }}>
      <b style={{ color: DECISOES[d.decisao].cor }}>{DECISOES[d.decisao].label}</b>
      <span style={{ color: 'var(--mu)' }}> · {quando(d.criado_em)} · {d.responsavel}</span>
      <p style={{ margin: '4px 0 0' }}><b>Motivo:</b> {d.motivo}</p>
      {d.observacao_campo && <p style={{ margin: '2px 0 0' }}><b>Observação de campo:</b> {d.observacao_campo}</p>}
      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--mu)' }}>
        No cenário da decisão (orçamento R$ {d.cenario.orcamento_mi} mi): CapEx {fmtMi(n.capex_mi)} · payback {fmtAnos(n.payback_anos)} · VPL {fmtMi(n.vpl_mi)} · {n.quadrante}
        {d.situacao_no_plano ? ` · ${d.situacao_no_plano}` : ''}
        {d.fonte_dados === 'mock' ? ' · dados de demonstração' : ''}
      </p>
    </div>
  )
}

export default function DecisaoMunicipio({ m, status, situacaoTexto, justificativa }: {
  m: Municipio
  status?: StatusPlano
  situacaoTexto?: string
  justificativa?: string
}) {
  const vigente    = useAppStore((s) => s.decisoes[m.id_municipio])
  const addDecisao = useAppStore((s) => s.addDecisao)
  const apiOffline = useAppStore((s) => s.apiOffline)
  const { toast } = useToast()

  const [aberto, setAberto]           = useState(false)
  const [escolha, setEscolha]         = useState<TipoDecisao>('aprovar')
  const [motivo, setMotivo]           = useState('')
  const [observacao, setObservacao]   = useState('')
  const [responsavel, setResponsavel] = useState(lerResponsavel)
  const [enviando, setEnviando]       = useState(false)
  const [erro, setErro]               = useState<string>()
  const [historico, setHistorico]     = useState<Decisao[] | null>(null)

  const aviso =
    escolha === 'aprovar' && status && status !== 'selecionado'
      ? 'Fora do plano atual: a aprovação fica registrada como exceção, com o motivo.'
      : escolha === 'descartar' && status === 'selecionado'
        ? 'Está no plano atual: o descarte precisa de um motivo que o comitê entenda.'
        : null

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(undefined)
    try {
      const d = await api.postDecisao({
        id_municipio: m.id_municipio,
        decisao: escolha,
        motivo,
        observacao_campo: observacao || undefined,
        responsavel,
        cenario: cenarioDaTela(useAppStore.getState()),
        situacao_no_plano: situacaoTexto,
        justificativa_ia: justificativa,
      })
      addDecisao(d)
      setHistorico((h) => (h ? [d, ...h] : h))
      guardarResponsavel(responsavel)
      setMotivo('')
      setObservacao('')
      setAberto(false)
      toast(`Decisão registrada: ${DECISOES[d.decisao].label}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section aria-label="Decisão" style={{ margin: '12px 0', padding: 10, border: '1px solid var(--ln)', borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>Decisão</b>
        {!aberto && (
          <button type="button" className="no-print" style={botao} onClick={() => setAberto(true)} disabled={apiOffline}>
            {vigente ? 'Registrar nova decisão' : 'Registrar decisão'}
          </button>
        )}
      </div>

      {vigente
        ? <div style={{ marginTop: 6 }}><Registro d={vigente} /></div>
        : <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--mu)' }}>Nenhuma decisão registrada.</p>}
      {apiOffline && (
        <p className="no-print" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--mu)' }}>
          Sem conexão com o servidor: não é possível registrar decisões agora.
        </p>
      )}

      {aberto && (
        <form className="no-print" onSubmit={registrar} style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <div role="radiogroup" aria-label="Decisão" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(DECISOES) as TipoDecisao[]).map((d) => (
              <label key={d} style={{
                ...botao, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40,
                border: `1px solid ${escolha === d ? DECISOES[d].cor : 'var(--ln)'}`,
                background: escolha === d ? 'var(--so)' : 'transparent', fontWeight: escolha === d ? 600 : 400,
              }}>
                <input type="radio" name="decisao" value={d} checked={escolha === d} onChange={() => setEscolha(d)} />
                {d === 'aprovar' ? 'Aprovar' : d === 'adiar' ? 'Adiar' : 'Descartar'}
              </label>
            ))}
          </div>
          {aviso && <p role="status" style={{ margin: 0, fontSize: 12, color: 'var(--q2b)' }}>{aviso}</p>}
          <label style={{ fontSize: 12, color: 'var(--mu)' }}>
            Motivo (obrigatório)
            <textarea required minLength={10} maxLength={2000} rows={3} value={motivo}
              onChange={(e) => setMotivo(e.target.value)} style={campo}
              placeholder="Ex.: prefeitura cede postes; demanda confirmada com a secretaria de educação." />
          </label>
          <label style={{ fontSize: 12, color: 'var(--mu)' }}>
            Observação de campo
            <textarea maxLength={2000} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} style={campo} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--mu)' }}>
            Responsável
            <input required minLength={2} maxLength={100} value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)} style={campo} autoComplete="name" />
          </label>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--mu)' }}>
            O cenário atual vai junto e os números são recalculados no servidor.
            {justificativa ? ' A justificativa por IA gerada neste cenário também é guardada.' : ''}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={enviando} style={{ ...botao, background: 'var(--ac)', color: '#fff', border: 0 }}>
              {enviando ? 'Registrando…' : 'Registrar'}
            </button>
            <button type="button" style={botao} onClick={() => setAberto(false)}>Cancelar</button>
          </div>
          {erro && <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--q2b)' }}>{erro}</p>}
        </form>
      )}

      {vigente && (
        <details className="no-print" style={{ marginTop: 8 }} onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open && !historico) {
            api.getDecisoes(m.id_municipio).then(setHistorico).catch(() => setHistorico([]))
          }
        }}>
          <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--mu)' }}>Histórico de decisões</summary>
          {historico === null
            ? <p style={{ fontSize: 12, color: 'var(--mu)' }}>Carregando…</p>
            : historico.map((d) => <div key={d.id} style={{ marginTop: 8 }}><Registro d={d} /></div>)}
        </details>
      )}
    </section>
  )
}
