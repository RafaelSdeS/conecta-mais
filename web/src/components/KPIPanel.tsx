/**
 * KPIPanel — grid de KPIs do portfólio atual, com o efeito das alavancas, a explicação do
 * portfólio e os achados do cenário pela IA.
 */

import { useAppStore } from '../store/appStore'
import KPICard from './KPICard'
import AiText from './AiText'
import Achados from './Achados'
import { alavancasDe, api, chaveNarrativa } from '../api/client'
import { montaPedidoPortfolio } from '../hooks/usePortfolioTrigger'
import { fmtMi, fmtAnos, fmtN0 } from '../utils/format'

export default function KPIPanel() {
  const kpis      = useAppStore((s) => s.kpis)
  const budget    = useAppStore((s) => s.budget)
  const total     = useAppStore((s) => Object.keys(s.financeiro).length)
  const portfolio = useAppStore((s) => s.portfolio)
  const params    = useAppStore((s) => s.params)
  const levers    = useAppStore((s) => s.levers)
  const narrativa = useAppStore((s) => s.narrativa)
  const setNarrativa = useAppStore((s) => s.setNarrativa)
  const recalculando = useAppStore((s) => s.portfolioLoading)
  // Achados valem só para o cenário em que foram gerados.
  const chaveCenario = useAppStore((s) => JSON.stringify(montaPedidoPortfolio(s)))
  const ids       = portfolio.map((m) => m.id_municipio)
  // O texto só vale para o mesmo portfólio no mesmo cenário (também usado no dossiê).
  const chave     = chaveNarrativa(ids, budget, params, levers)

  const pay    = kpis?.paybackMedio     ?? 0
  const count  = kpis?.countPortfolio   ?? 0
  const alunos = kpis?.alunosConectados ?? 0
  const used   = kpis?.capexUsado       ?? 0
  const vpl    = kpis?.vplTotal         ?? 0
  const sem    = kpis?.semAlavancas

  const efeitoPay = sem && count > 0 ? pay - sem.paybackMedio : 0
  const efeitoVpl = sem && count > 0 ? vpl - sem.vplTotal : 0
  const comAlavanca = Math.abs(efeitoPay) > 0.005 || Math.abs(efeitoVpl) > 0.005

  return (
    <>
      <div
        aria-busy={recalculando}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
          // Esmaecido enquanto o plano é recalculado: os números ainda são do cenário anterior.
          opacity: recalculando ? 0.55 : 1,
          transition: 'opacity .2s',
        }}
      >
        <KPICard
          label="Payback médio do portfólio"
          value={pay}
          format={(v) => (count > 0 ? fmtAnos(v) : '—')}
          detail={
            comAlavanca
              ? `Alavancas: ${efeitoPay <= 0 ? '' : '+'}${efeitoPay.toFixed(2)} anos vs. sem alavancas`
              : 'Sem efeito de alavancas no payback'
          }
        />
        <KPICard
          label="Municípios no portfólio"
          value={count}
          format={(v) => String(Math.round(v))}
          detail={`de ${total} no escopo do cenário`}
        />
        <KPICard
          label="Alunos em escolas sem internet"
          value={alunos}
          format={(v) => fmtN0(v)}
          detail={`${fmtN0(kpis?.escolasAtendidas ?? 0)} escolas sem internet para aprendizagem`}
        />
        <KPICard
          label="CapEx alocado"
          value={used}
          format={(v) => fmtMi(v)}
          detail={`de R$ ${budget} mi · VPL ${fmtMi(vpl)}${comAlavanca ? ` (${efeitoVpl >= 0 ? '+' : ''}${efeitoVpl.toFixed(1)} das alavancas)` : ''}`}
        />
      </div>
      <AiText
        key={chave}
        label="Explicar portfólio (IA)"
        chave={`narrativa:${chave}`}
        aviso="A explicação do portfólio ficou pronta no Painel."
        disabled={portfolio.length === 0}
        texto={narrativa?.chave === chave ? narrativa.texto : undefined}
        run={() =>
          api
            .postPortfolioNarrativa(ids, budget, params, alavancasDe(levers))
            .then((r) => r.texto)
        }
        onResult={(texto) => setNarrativa({ chave, texto })}
      />
      <Achados key={chaveCenario} chave={chaveCenario} disabled={!kpis} />
    </>
  )
}
