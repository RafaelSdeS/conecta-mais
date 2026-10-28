/**
 * SolutionView — arquitetura IBM watsonx, ROI estimado e fases de entrega.
 */

import { useEffect, useState } from 'react'
import {
  AGENT_DESCRIPTIONS,
  ROI_ROWS,
  DELIVERY_PHASES,
  SOLUTION_KPIS,
} from '../utils/constants'
import { useAppStore } from '../store/appStore'
import { api, type BacktestResult } from '../api/client'
import logoIcone       from '../assets/logo.svg'
import logoIconeBranca from '../assets/logo-branca.svg'

export default function SolutionView() {
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null)
  const theme = useAppStore((s) => s.theme)

  // ── Backtest 2021 → 2025 ───────────────────────────────────────────────────
  const [backtest, setBacktest]         = useState<BacktestResult | null>(null)
  const [backtestLoading, setBtLoading] = useState(false)
  const [backtestError, setBtError]     = useState<string | null>(null)

  useEffect(() => {
    setBtLoading(true)
    api.getBacktest()
      .then(setBacktest)
      .catch((e: unknown) => setBtError(String(e)))
      .finally(() => setBtLoading(false))
  }, [])

  const pn: React.CSSProperties = {
    background: 'var(--pn)',
    border: '1px solid var(--ln)',
    borderRadius: 6,
    padding: 16,
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src={theme === 'dark' ? logoIconeBranca : logoIcone}
          alt=""
          aria-hidden="true"
          style={{ width: 40, height: 40, flexShrink: 0 }}
        />
        <div>
          <h1>Solução</h1>
          <p style={{ color: 'var(--mu)' }}>
            Arquitetura multiagente, retorno estimado e plano de entrega.
          </p>
        </div>
      </div>

      {/* KPIs do mercado */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        {SOLUTION_KPIS.map((kpi) => (
          <div key={kpi.label} style={pn}>
            <div style={{ fontSize: 12, color: 'var(--mu)' }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3, margin: '4px 0' }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: 'var(--mu)' }}>{kpi.detail}</div>
          </div>
        ))}
      </div>

      {/* Grid: agentes (esq) + ROI (dir) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
        gap: 16,
        alignItems: 'start',
        marginBottom: 16,
      }}>
        {/* Painel de agentes */}
        <div style={pn}>
          <h2>Arquitetura (IBM watsonx)</h2>
          <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 8 }}>
            Analista (dashboard e chat) → Orquestrador watsonx Orchestrate → cinco agentes.
            Selecione um para ver a função.
          </p>

          {/* Botões de agentes */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {AGENT_DESCRIPTIONS.map((agent, i) => (
              <button
                key={agent.name}
                onClick={() => setSelectedAgent(selectedAgent === i ? null : i)}
                style={{
                  display: 'block',
                  width: '100%',
                  font: 'inherit',
                  fontSize: 13,
                  color: 'inherit',
                  textAlign: 'left',
                  background: selectedAgent === i ? 'var(--so)' : 'none',
                  border: 0,
                  borderBottom: '1px solid var(--ln)',
                  padding: '10px 8px',
                  cursor: 'pointer',
                  boxShadow: selectedAgent === i ? 'inset 3px 0 0 var(--ac)' : 'none',
                }}
                onMouseEnter={(e) => { if (selectedAgent !== i) e.currentTarget.style.background = 'var(--so)' }}
                onMouseLeave={(e) => { if (selectedAgent !== i) e.currentTarget.style.background = 'none' }}
              >
                {agent.name}
              </button>
            ))}
          </div>

          {/* Descrição do agente selecionado */}
          <div style={{ padding: '12px 8px', minHeight: 84, fontSize: 13 }}>
            {selectedAgent !== null ? (
              <>
                <b>{AGENT_DESCRIPTIONS[selectedAgent].name}</b>
                <br />
                <span style={{ color: 'var(--mu)' }}>{AGENT_DESCRIPTIONS[selectedAgent].description}</span>
              </>
            ) : (
              <span style={{ color: 'var(--mu)' }}>Selecione um agente para ver sua função.</span>
            )}
          </div>

          <p style={{ fontSize: 12, color: 'var(--mu)', margin: 0 }}>
            Dados: Anatel CKAN, Base dos Dados, INEP e IBGE em GeoParquet por UF.
            Governança: watsonx.governance.
          </p>
        </div>

        {/* Tabela de ROI */}
        <div style={pn}>
          <h2>ROI estimado para a Vivo</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--ln)', fontWeight: 500, fontSize: 12, color: 'var(--mu)' }}>
                  Vetor de ganho
                </th>
                <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--ln)', fontWeight: 500, fontSize: 12, color: 'var(--mu)', whiteSpace: 'nowrap' }}>
                  Impacto anual
                </th>
              </tr>
            </thead>
            <tbody>
              {ROI_ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid var(--ln)' }}>
                    {row.highlight ? <b>{row.label}</b> : row.label}
                  </td>
                  <td style={{
                    padding: '7px 8px',
                    borderBottom: '1px solid var(--ln)',
                    textAlign: 'right',
                    fontWeight: row.highlight ? 600 : 400,
                    color: row.highlight ? 'var(--ok)' : 'inherit',
                    whiteSpace: 'nowrap',
                  }}>
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 10 }}>
            Custos: R$ 4,5 mi no ano 1 e R$ 2,5 mi/ano depois.
            Payback da ferramenta em menos de 2 meses após o primeiro ciclo trimestral.
          </p>
        </div>
      </div>

      {/* Fases de entrega */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        {DELIVERY_PHASES.map((phase) => (
          <div key={phase.title} style={pn}>
            <h2 style={{ marginBottom: 8 }}>{phase.title}</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {phase.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Validação do modelo — Backtest 2021 → 2025 */}
      <div style={pn}>
        <h2 style={{ marginBottom: 8 }}>Validação do modelo — Backtest 2021 → 2025</h2>
        <p style={{ fontSize: 13, color: 'var(--mu)', marginBottom: 12 }}>
          Dos municípios classificados como Q1/Q2a em 2021, quantos realmente expandiram
          sua base de fibra até 2025 (crescimento ≥ threshold)?
        </p>

        {backtestLoading && (
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>Carregando…</p>
        )}
        {backtestError && !backtestLoading && (
          <p style={{ fontSize: 13, color: 'var(--mu)' }}>
            API offline — resultado de backtest indisponível.
          </p>
        )}
        {backtest && !backtestLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Precision',              value: `${(backtest.precision * 100).toFixed(0)}%`,   detail: 'dos Q1/Q2a que realmente cresceram' },
              { label: 'Recall',                 value: `${(backtest.recall * 100).toFixed(0)}%`,      detail: 'dos que cresceram que eram Q1/Q2a' },
              { label: 'F1-Score',               value: backtest.f1.toFixed(2),                        detail: 'média harmônica precision/recall' },
              { label: 'Municípios Q1/Q2a 2021', value: String(backtest.total_q1_q2a_2021),            detail: 'classificados pelo modelo' },
              { label: 'Cresceram em fibra',     value: String(backtest.total_cresceram),              detail: `threshold: +${((backtest.threshold_crescimento - 1) * 100).toFixed(0)}%` },
              { label: 'Acertos',                value: String(backtest.acertados),                    detail: 'Q1/Q2a que de fato cresceram' },
            ].map(({ label, value, detail }) => (
              <div key={label} style={{ ...pn, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
