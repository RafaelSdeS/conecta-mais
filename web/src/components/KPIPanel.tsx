/**
 * KPIPanel — grid de KPIs do portfólio atual, com o efeito das alavancas.
 */

import { useAppStore } from '../store/appStore'
import KPICard from './KPICard'
import AiText from './AiText'
import { alavancasDe, api, chaveNarrativa } from '../api/client'
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
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
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
        disabled={portfolio.length === 0}
        initial={narrativa?.chave === chave ? narrativa.texto : undefined}
        run={() =>
          api
            .postPortfolioNarrativa(ids, budget, params, alavancasDe(levers))
            .then((r) => r.texto)
        }
        onResult={(texto) => setNarrativa({ chave, texto })}
      />
    </>
  )
}
