/**
 * KPIPanel — grid de 4 KPI cards do portfólio atual.
 */

import { useAppStore } from '../store/appStore'
import KPICard from './KPICard'
import { fmtMi, fmtAnos, fmtN0 } from '../utils/format'

export default function KPIPanel() {
  const kpis   = useAppStore((s) => s.kpis)
  const budget = useAppStore((s) => s.budget)

  const pay   = kpis?.paybackMedio     ?? 0
  const count = kpis?.countPortfolio   ?? 0
  const alunos = kpis?.alunosConectados ?? 0
  const used  = kpis?.capexUsado       ?? 0
  const pay0  = kpis?.paybackQ2Baseline ?? 0

  return (
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
        detail={`Q2 sem alavancas: ${fmtAnos(pay0)}`}
      />
      <KPICard
        label="Municípios no portfólio"
        value={count}
        format={(v) => String(Math.round(v))}
        detail="de 417"
      />
      <KPICard
        label="Alunos conectados"
        value={alunos}
        format={(v) => fmtN0(v)}
        detail={`${kpis ? Math.round(kpis.alunosConectados / 270) : 0} escolas`}
      />
      <KPICard
        label="CapEx alocado"
        value={used}
        format={(v) => fmtMi(v)}
        detail={`de R$ ${budget} mi de orçamento`}
      />
    </div>
  )
}
