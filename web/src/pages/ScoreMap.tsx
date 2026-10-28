/** Painel de scores — tabela de municípios com filtros, badges de quadrante e pesos customizados. */

import { useEffect, useRef, useState } from 'react'
import { api, type Municipio, type ScoreWeights } from '../api/client'
import QuadrantBadge from '../components/QuadrantBadge'

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO',
  'MA','MG','MS','MT','PA','PB','PE','PI','PR',
  'RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]
const QUADRANTES = ['Q1','Q2a','Q2b','Q3','Q4']

const DEFAULT_WEIGHTS: ScoreWeights = { w_M: 0.25, w_I: 0.25, w_C: 0.25, w_A: 0.25 }

function fmt1(n: number | null | undefined) { return n == null ? '—' : n.toFixed(1) }
function fmtPct(n: number) { return `${(n * 100).toFixed(0)}%` }
function sum(w: ScoreWeights) { return w.w_M + w.w_I + w.w_C + w.w_A }

export default function ScoreMap() {
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [ufFilter, setUfFilter] = useState('')
  const [qFilter, setQFilter]   = useState('')
  const [search, setSearch]     = useState('')
  const [sortKey, setSortKey]   = useState<keyof Municipio>('score_total')
  const [sortAsc, setSortAsc]   = useState(false)

  // ── Pesos customizados ────────────────────────────────────────────────────
  const [weights, setWeights]         = useState<ScoreWeights>(DEFAULT_WEIGHTS)
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [weightsLoading, setWLoading] = useState(false)
  const [weightsError, setWError]     = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch inicial de municípios (sem pesos customizados)
  useEffect(() => {
    setLoading(true)
    api.getMunicipios({ uf: ufFilter || undefined, quadrante: qFilter || undefined })
      .then(setMunicipios)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [ufFilter, qFilter])

  // Recalcula scores quando pesos mudam (debounce 500ms, só se soma = 1)
  useEffect(() => {
    const total = sum(weights)
    if (Math.abs(total - 1.0) > 0.005) return // pesos não somam 1 — aguarda
    if (
      weights.w_M === DEFAULT_WEIGHTS.w_M &&
      weights.w_I === DEFAULT_WEIGHTS.w_I &&
      weights.w_C === DEFAULT_WEIGHTS.w_C &&
      weights.w_A === DEFAULT_WEIGHTS.w_A
    ) return // pesos padrão — usa GET /municipios já carregado

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setWLoading(true)
      setWError(null)
      api.postScores(weights)
        .then(setMunicipios)
        .catch(e => setWError(String(e)))
        .finally(() => setWLoading(false))
    }, 500)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights.w_M, weights.w_I, weights.w_C, weights.w_A])

  function handleWeight(key: keyof ScoreWeights, value: number) {
    setWeights(w => ({ ...w, [key]: value }))
  }

  function resetWeights() {
    setWeights(DEFAULT_WEIGHTS)
    // Reload base
    setLoading(true)
    api.getMunicipios({ uf: ufFilter || undefined, quadrante: qFilter || undefined })
      .then(setMunicipios)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }

  const weightTotal = sum(weights)
  const weightValid = Math.abs(weightTotal - 1.0) <= 0.005

  const filtered = municipios
    .filter(m => !search || m.nome.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortKey] as number, vb = b[sortKey] as number
      return sortAsc ? va - vb : vb - va
    })

  function toggleSort(key: keyof Municipio) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const thClass = 'px-3 py-2 text-left text-xs font-medium cursor-pointer select-none whitespace-nowrap'
    + ' text-[var(--mu)] hover:text-[var(--tx)] border-b border-[var(--ln)]'

  const inputBase = 'px-3 py-1.5 text-sm rounded border border-[var(--ln)] bg-[var(--pn)] focus:outline-none focus:border-[var(--ac)]'

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold mb-1">Painel de Scores</h1>
        <p className="text-sm" style={{ color: 'var(--mu)' }}>
          {municipios.length} municípios · clique no cabeçalho para ordenar
        </p>
      </div>

      {/* Filtros e pesos */}
      <div className="flex flex-wrap gap-3 mb-4 items-start">
        <input
          type="search"
          placeholder="Buscar município…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inputBase}
        />
        <select
          value={ufFilter}
          onChange={e => setUfFilter(e.target.value)}
          className={inputBase}
        >
          <option value="">Todas as UFs</option>
          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </select>
        <select
          value={qFilter}
          onChange={e => setQFilter(e.target.value)}
          className={inputBase}
        >
          <option value="">Todos os quadrantes</option>
          {QUADRANTES.map(q => <option key={q} value={q}>{q}</option>)}
        </select>

        {/* Botão de pesos customizados */}
        <button
          onClick={() => setWeightsOpen(o => !o)}
          className="px-3 py-1.5 text-sm rounded border cursor-pointer"
          style={{
            borderColor: weightsOpen ? 'var(--ac)' : 'var(--ln)',
            background: weightsOpen ? 'var(--so)' : 'var(--pn)',
            color: 'var(--tx)',
          }}
        >
          ⚖ Pesos {weightsOpen ? '▲' : '▼'}
        </button>
      </div>

      {/* Painel de pesos customizados */}
      {weightsOpen && (
        <div className="mb-4 rounded-md border border-[var(--ln)] bg-[var(--pn)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">
              Pesos dos índices
              {weightsLoading && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--mu)' }}>recalculando…</span>}
            </h2>
            <button
              onClick={resetWeights}
              className="text-xs px-2 py-1 rounded border cursor-pointer"
              style={{ borderColor: 'var(--ln)', color: 'var(--mu)', background: 'transparent' }}
            >
              Restaurar padrão
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3" style={{ maxWidth: 480 }}>
            {(
              [
                ['w_M', 'M — Mercado',              'Domicílios, renda, HHI, market share Vivo'],
                ['w_I', 'I — Impacto educacional',  'Matrículas, escolas sem internet, IVS'],
                ['w_C', 'C — Custo de implantação', 'Distância ao backhaul, área, elevação'],
                ['w_A', 'A — Alavancagem',           'FUST, Acordo TCU, porte operador'],
              ] as [keyof ScoreWeights, string, string][]
            ).map(([key, label, detail]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: 'var(--tx)' }} title={detail}>
                    {label}
                  </label>
                  <span className="text-xs font-semibold" style={{ color: 'var(--ac)' }}>
                    {fmtPct(weights[key])}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[key]}
                  onChange={e => handleWeight(key, +e.target.value)}
                  className="w-full accent-[var(--ac)]"
                />
              </div>
            ))}
          </div>

          {/* Aviso de soma */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="text-xs px-2 py-1 rounded"
              style={{
                background: weightValid ? '#dcfce7' : '#fee2e2',
                color: weightValid ? '#15803d' : '#b91c1c',
              }}
            >
              Soma: {fmtPct(weightTotal)} {weightValid ? '✓' : '— deve somar 100%'}
            </div>
            {weightsError && (
              <span className="text-xs" style={{ color: '#b91c1c' }}>{weightsError}</span>
            )}
          </div>
        </div>
      )}

      {/* Estado de carregamento / erro */}
      {(loading || weightsLoading) && (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--mu)' }}>
          Carregando…
        </div>
      )}
      {error && !loading && (
        <div className="text-sm py-4 text-red-600">
          Erro ao carregar dados: {error}
        </div>
      )}

      {/* Tabela */}
      {!loading && !weightsLoading && !error && (
        <div className="rounded-md border border-[var(--ln)] bg-[var(--pn)] overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {([
                  ['nome',        'Município'],
                  ['uf',          'UF'],
                  ['quadrante',   'Quadrante'],
                  ['score_M',     'M'],
                  ['score_I',     'I'],
                  ['score_C',     'C'],
                  ['score_A',     'A'],
                  ['score_total', 'Total'],
                ] as [keyof Municipio, string][]).map(([key, label]) => (
                  <th key={key} className={thClass} onClick={() => toggleSort(key)}>
                    {label}
                    {sortKey === key && (
                      <span className="ml-1">{sortAsc ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm"
                    style={{ color: 'var(--mu)' }}>
                    Nenhum município encontrado.
                  </td>
                </tr>
              ) : filtered.map(m => (
                <tr key={m.id_municipio}
                  className="border-t border-[var(--ln)] hover:bg-[var(--so)] cursor-default">
                  <td className="px-3 py-2 font-medium">{m.nome}</td>
                  <td className="px-3 py-2 text-[var(--mu)]">{m.uf}</td>
                  <td className="px-3 py-2">
                    <QuadrantBadge quadrante={m.quadrante} />
                  </td>
                  <td className="px-3 py-2 text-right">{fmt1(m.score_M)}</td>
                  <td className="px-3 py-2 text-right">{fmt1(m.score_I)}</td>
                  <td className="px-3 py-2 text-right">{fmt1(m.score_C)}</td>
                  <td className="px-3 py-2 text-right">{fmt1(m.score_A)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt1(m.score_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-xs border-t border-[var(--ln)]"
            style={{ color: 'var(--mu)' }}>
            Mostrando {filtered.length} de {municipios.length} municípios
          </div>
        </div>
      )}
    </div>
  )
}
