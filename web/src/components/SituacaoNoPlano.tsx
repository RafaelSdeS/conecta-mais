/**
 * SituacaoNoPlano — por que o município entrou ou ficou fora do plano e o que mudaria isso.
 * "O que mudaria para incluir?" roda o mesmo portfólio com o município forçado e mostra quem sairia.
 */

import { useState } from 'react'
import { alavancasDe, api, type Municipio } from '../api/client'
import { montaPedidoPortfolio } from '../hooks/usePortfolioTrigger'
import { useAppStore } from '../store/appStore'
import { TETO_PAYBACK_ANOS } from '../utils/constants'
import { fmtAnos, fmtMi, fmtN0 } from '../utils/format'
import type { StatusPlano } from '../utils/plano'

const botao: React.CSSProperties = {
  font: 'inherit', fontSize: 13, borderRadius: 4, padding: '8px 12px', cursor: 'pointer',
  background: 'transparent', color: 'var(--tx)', border: '1px solid var(--ln)', marginTop: 8,
}

const sinal = (v: number, fmt: (x: number) => string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`

export default function SituacaoNoPlano({ m, situacao }: { m: Municipio; situacao: { status: StatusPlano; texto: string } }) {
  const params    = useAppStore((s) => s.params)
  const levers    = useAppStore((s) => s.levers)
  const budget    = useAppStore((s) => s.budget)
  const objetivo  = useAppStore((s) => s.objetivo)
  const filters   = useAppStore((s) => s.filters)
  const portfolio = useAppStore((s) => s.portfolio)
  const kpis      = useAppStore((s) => s.kpis)

  // O resultado só vale para o cenário em que foi calculado.
  const chave = JSON.stringify([m.id_municipio, montaPedidoPortfolio({ budget, objetivo, params, levers, filters })])
  const [sim, setSim] = useState<{ chave: string; texto: string[] } | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string>()

  async function simular() {
    setCarregando(true)
    setErro(undefined)
    try {
      const pedido = montaPedidoPortfolio(useAppStore.getState())
      if (situacao.status === 'acima_teto') {
        // Única saída: alavancas. Testa todas ligadas (TCU só vale para municípios do acordo).
        const r = await api.postFinancial(m.id_municipio, params, alavancasDe({ fust: true, tcu: !!m.acordo_migracao, enec: true }))
        const entra = r.payback_anos != null && isFinite(r.payback_anos) && r.payback_anos <= TETO_PAYBACK_ANOS
        setSim({ chave, texto: [entra
          ? `Com todas as alavancas, o payback cai para ${fmtAnos(r.payback_anos)} e o município passa a concorrer no plano.`
          : `Mesmo com todas as alavancas, o payback fica em ${fmtAnos(r.payback_anos)}: só entra com mudança de premissas ou outra tecnologia.`] })
        return
      }
      const r = await api.postPortfolio({ ...pedido, incluir: [m.id_municipio] })
      if (r.status === 'Infeasible') {
        setSim({ chave, texto: [`Não cabe nem sozinho no orçamento de R$ ${pedido.budget} mi. Seria preciso aumentar o orçamento.`] })
        return
      }
      const novos = new Set(r.municipios.map((x) => x.id_municipio))
      const saem = portfolio.filter((x) => !novos.has(x.id_municipio)).map((x) => x.nome)
      const nomes = saem.length > 5 ? `${saem.slice(0, 5).join(', ')} e mais ${saem.length - 5}` : saem.join(', ')
      setSim({ chave, texto: [
        saem.length ? `Para incluir ${m.nome}, sairiam: ${nomes}.` : `${m.nome} entra sem tirar ninguém do plano.`,
        `Alunos atendidos ${sinal(r.alunos_atendidos - (kpis?.alunosConectados ?? 0), fmtN0)} · `
          + `VPL ${sinal(r.vpl_total - (kpis?.vplTotal ?? 0), fmtMi)} · `
          + `CapEx ${sinal(r.capex_total - (kpis?.capexUsado ?? 0), fmtMi)}`,
      ] })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }

  const fora = situacao.status !== 'selecionado' && situacao.status !== 'fora_escopo'
  const atual = sim?.chave === chave ? sim : null

  return (
    <section aria-label="Situação no plano" style={{
      margin: '12px 0', padding: 10, borderRadius: 6, border: '1px solid var(--ln)',
      borderLeft: `4px solid ${situacao.status === 'selecionado' ? 'var(--ok)' : 'var(--q2b)'}`,
    }}>
      <b style={{ fontSize: 13 }}>Situação no plano</b>
      <p style={{ margin: '4px 0 0', fontSize: 13 }}>{situacao.texto}</p>
      {fora && !atual && (
        <button type="button" className="no-print" style={botao} onClick={simular} disabled={carregando}>
          {carregando ? 'Calculando…' : 'O que mudaria para incluir?'}
        </button>
      )}
      {atual?.texto.map((t) => <p key={t} style={{ margin: '6px 0 0', fontSize: 13 }}>{t}</p>)}
      {erro && <p role="alert" style={{ fontSize: 12, color: 'var(--q2b)', margin: '6px 0 0' }}>{erro}</p>}
    </section>
  )
}
