/** Simulador de alavancas — business case e portfólio. */

import { useState } from 'react'
import {
  api,
  type Alavancas,
  type FinancialParams,
  type FinancialResult,
  type PortfolioResult,
} from '../api/client'
import QuadrantBadge from '../components/QuadrantBadge'

const DEFAULT_PARAMS: FinancialParams = {
  custo_hp: 477,
  custo_backhaul_km: 61800,
  custo_ativacao: 500,
  adesao_pct: 0.25,
  arpu_mensal: 87.7,
  margem_ebitda: 0.40,
  wacc: 0.15,
  wacc_fust: 0.0325,
  anos_projeto: 10,
  aliquota_imposto: 0.34,
  arpu_escolar_mensal: 1200,
}

const DEFAULT_ALAVANCAS: Alavancas = {
  backhaul_comprometido: false,
  fust_reembolsavel: false,
  receita_escolar: false,
}

function fmtMi(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toFixed(2)} mi`
}
function fmtAnos(v: number | null) {
  if (v == null || !isFinite(v)) return '∞'
  return `${v.toFixed(1)} anos`
}

export default function Simulator() {
  const [idMunicipio, setIdMunicipio]   = useState('3550308')
  const [params, setParams]             = useState<FinancialParams>(DEFAULT_PARAMS)
  const [alavancas, setAlavancas]       = useState<Alavancas>(DEFAULT_ALAVANCAS)
  const [budget, setBudget]             = useState(30)
  const [lambda_, setLambda]            = useState(0.5)
  const [maxPayback, setMaxPayback]     = useState(10)
  const [result, setResult]             = useState<FinancialResult | null>(null)
  const [portfolio, setPortfolio]       = useState<PortfolioResult | null>(null)
  const [loadingFin, setLoadingFin]     = useState(false)
  const [loadingPort, setLoadingPort]   = useState(false)
  const [error, setError]               = useState<string | null>(null)

  async function calcularBusinessCase() {
    setLoadingFin(true)
    setError(null)
    try {
      const r = await api.postFinancial(idMunicipio, params, alavancas)
      setResult(r)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingFin(false)
    }
  }

  async function otimizarPortfolio() {
    setLoadingPort(true)
    setError(null)
    try {
      const r = await api.postPortfolio({
        budget,
        lambda_,
        max_payback: maxPayback,
        alavancas,
        params,
      })
      setPortfolio(r)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingPort(false)
    }
  }

  const inputCls = 'w-full px-2 py-1.5 text-sm rounded border border-[var(--ln)] bg-[var(--pn)] focus:outline-none focus:border-[var(--ac)]'
  const labelCls = 'text-xs font-medium block mb-1'
  const sectionCls = 'bg-[var(--pn)] border border-[var(--ln)] rounded-md p-4'

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold mb-1">Simulador de Alavancas</h1>
        <p className="text-sm" style={{ color: 'var(--mu)' }}>
          Ajuste as premissas e alavancas para ver o business case e otimizar o portfólio.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Coluna esquerda — inputs */}
        <div className="flex flex-col gap-4">

          {/* Município */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold mb-3">Município</h2>
            <label className={labelCls} style={{ color: 'var(--mu)' }}>
              Código IBGE (7 dígitos)
            </label>
            <input
              className={inputCls}
              value={idMunicipio}
              onChange={e => setIdMunicipio(e.target.value)}
              placeholder="Ex: 3550308 (São Paulo)"
            />
          </div>

          {/* Alavancas */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold mb-3">Alavancas</h2>
            {([
              ['backhaul_comprometido', 'Backhaul Acordo TCU (CapEx zerado)'],
              ['fust_reembolsavel',     'Subsídio FUST/BNDES (WACC reduzido no VPL)'],
              ['receita_escolar',       'Receita âncora escolas (B2G)'],
            ] as [keyof Alavancas, string][]).map(([key, label]) => (
              <label key={key}
                className="flex items-center gap-2 mb-2 cursor-pointer text-sm"
                style={alavancas[key] ? { color: 'var(--ac)', fontWeight: 500 } : {}}>
                <input
                  type="checkbox"
                  checked={alavancas[key] as boolean}
                  onChange={e => setAlavancas(a => ({ ...a, [key]: e.target.checked }))}
                  className="accent-[var(--ac)] w-4 h-4"
                />
                {label}
              </label>
            ))}
          </div>

          {/* Premissas financeiras */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold mb-3">Premissas</h2>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['custo_hp',           'Custo por HP (R$)',    1],
                ['custo_backhaul_km',  'Custo backhaul /km',   1],
                ['adesao_pct',         'Adesão maturidade',   0.01],
                ['arpu_mensal',        'ARPU mensal (R$)',     0.1],
                ['margem_ebitda',      'Margem EBITDA',       0.01],
                ['wacc',               'WACC',                0.001],
              ] as [keyof FinancialParams, string, number][]).map(([key, label, step]) => (
                <div key={key}>
                  <label className={labelCls} style={{ color: 'var(--mu)' }}>{label}</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={params[key] as number}
                    step={step}
                    onChange={e => setParams(p => ({ ...p, [key]: +e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Portfólio */}
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold mb-3">Parâmetros do portfólio</h2>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelCls} style={{ color: 'var(--mu)' }}>
                  Orçamento (R$ mi)
                </label>
                <input type="number" className={inputCls} value={budget} min={1}
                  onChange={e => setBudget(+e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--mu)' }}>
                  Payback máx. (anos)
                </label>
                <input type="number" className={inputCls} value={maxPayback} min={1}
                  onChange={e => setMaxPayback(+e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--mu)' }}>
                  λ impacto vs retorno
                </label>
                <input type="number" className={inputCls} value={lambda_} min={0} max={1} step={0.1}
                  onChange={e => setLambda(+e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={calcularBusinessCase} disabled={loadingFin}
                className="flex-1 py-2 text-sm font-medium rounded cursor-pointer
                           bg-[var(--ac)] text-[var(--on)] border border-[var(--ac)]
                           disabled:opacity-50">
                {loadingFin ? 'Calculando…' : 'Business case'}
              </button>
              <button onClick={otimizarPortfolio} disabled={loadingPort}
                className="flex-1 py-2 text-sm font-medium rounded cursor-pointer
                           bg-[var(--ac)] text-[var(--on)] border border-[var(--ac)]
                           disabled:opacity-50">
                {loadingPort ? 'Otimizando…' : 'Otimizar portfólio'}
              </button>
            </div>
          </div>
        </div>

        {/* Coluna direita — resultados */}
        <div className="flex flex-col gap-4">

          {/* Business case */}
          {result && (
            <div className={sectionCls}>
              <h2 className="text-sm font-semibold mb-3">
                Business case — {result.id_municipio}
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-1.5 text-xs font-medium border-b border-[var(--ln)]"
                      style={{ color: 'var(--mu)' }}>Métrica</th>
                    <th className="text-right py-1.5 text-xs font-medium border-b border-[var(--ln)]"
                      style={{ color: 'var(--mu)' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['CapEx total',       fmtMi(result.capex.total)],
                    ['CapEx acesso',      fmtMi(result.capex.acesso)],
                    ['CapEx backhaul',    fmtMi(result.capex.backhaul)],
                    ['CapEx ativação',    fmtMi(result.capex.ativacao)],
                    ['Receita anual',     fmtMi(result.receita_anual)],
                    ['EBITDA anual',      fmtMi(result.ebitda_anual)],
                    ['Payback simples',   fmtAnos(result.payback_anos)],
                    ['VPL',               fmtMi(result.npv)],
                  ] as [string, string][]).map(([k, v]) => (
                    <tr key={k} className="border-t border-[var(--ln)]">
                      <td className="py-1.5" style={{ color: 'var(--mu)' }}>{k}</td>
                      <td className="py-1.5 text-right font-medium">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Sensibilidade */}
              <h3 className="text-xs font-semibold mt-4 mb-2" style={{ color: 'var(--mu)' }}>
                Sensibilidade à adesão
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {result.sensitivity.map(row => (
                  <div key={row.adesao_pct}
                    className="text-center rounded p-2 border border-[var(--ln)] bg-[var(--so)]">
                    <div className="text-lg font-semibold">{fmtAnos(row.payback_anos)}</div>
                    <div className="text-xs" style={{ color: 'var(--mu)' }}>
                      {(row.adesao_pct * 100).toFixed(0)}% adesão
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfólio */}
          {portfolio && (
            <div className={sectionCls}>
              <h2 className="text-sm font-semibold mb-3">Portfólio otimizado</h2>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {([
                  ['Municípios',   String(portfolio.n_selecionados)],
                  ['CapEx total',  fmtMi(portfolio.capex_total)],
                  ['Payback médio',fmtAnos(portfolio.payback_medio)],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="rounded border border-[var(--ln)] p-3 bg-[var(--so)]">
                    <div className="text-xs mb-1" style={{ color: 'var(--mu)' }}>{k}</div>
                    <div className="text-xl font-semibold">{v}</div>
                  </div>
                ))}
              </div>

              {/* Tabela de municípios selecionados */}
              {portfolio.municipios.length > 0 && (
                <div className="overflow-x-auto rounded border border-[var(--ln)]">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        {['Município','UF','Quadrante','Score'].map(h => (
                          <th key={h}
                            className="px-3 py-2 text-left text-xs font-medium border-b border-[var(--ln)]"
                            style={{ color: 'var(--mu)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.municipios.map(m => (
                        <tr key={m.id_municipio}
                          className="border-t border-[var(--ln)] hover:bg-[var(--so)]">
                          <td className="px-3 py-1.5 font-medium">{m.nome}</td>
                          <td className="px-3 py-1.5 text-[var(--mu)]">{m.uf}</td>
                          <td className="px-3 py-1.5">
                            <QuadrantBadge quadrante={m.quadrante} />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {m.score_total?.toFixed(1) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {portfolio.n_selecionados === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--mu)' }}>
                  Nenhum município elegível com as restrições atuais.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
