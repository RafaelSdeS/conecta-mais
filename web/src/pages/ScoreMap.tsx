/** Painel de scores — tabela de municípios com filtros e badges de quadrante. */

import { useEffect, useState } from 'react'
import { api, type Municipio } from '../api/client'
import QuadrantBadge from '../components/QuadrantBadge'

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO',
  'MA','MG','MS','MT','PA','PB','PE','PI','PR',
  'RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]
const QUADRANTES = ['Q1','Q2a','Q2b','Q3','Q4']

function fmt1(n: number | null) { return n == null ? '—' : n.toFixed(1) }

export default function ScoreMap() {
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [ufFilter, setUfFilter] = useState('')
  const [qFilter, setQFilter]   = useState('')
  const [search, setSearch]     = useState('')
  const [sortKey, setSortKey]   = useState<keyof Municipio>('score_total')
  const [sortAsc, setSortAsc]   = useState(false)

  useEffect(() => {
    setLoading(true)
    api.getMunicipios({ uf: ufFilter || undefined, quadrante: qFilter || undefined })
      .then(setMunicipios)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [ufFilter, qFilter])

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

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold mb-1">Painel de Scores</h1>
        <p className="text-sm" style={{ color: 'var(--mu)' }}>
          {municipios.length} municípios · clique no cabeçalho para ordenar
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Buscar município…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm rounded border border-[var(--ln)] bg-[var(--pn)] focus:outline-none focus:border-[var(--ac)]"
        />
        <select
          value={ufFilter}
          onChange={e => setUfFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded border border-[var(--ln)] bg-[var(--pn)] focus:outline-none"
        >
          <option value="">Todas as UFs</option>
          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </select>
        <select
          value={qFilter}
          onChange={e => setQFilter(e.target.value)}
          className="px-3 py-1.5 text-sm rounded border border-[var(--ln)] bg-[var(--pn)] focus:outline-none"
        >
          <option value="">Todos os quadrantes</option>
          {QUADRANTES.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>

      {/* Estado de carregamento / erro */}
      {loading && (
        <div className="text-sm py-8 text-center" style={{ color: 'var(--mu)' }}>
          Carregando…
        </div>
      )}
      {error && (
        <div className="text-sm py-4 text-red-600">
          Erro ao carregar dados: {error}
        </div>
      )}

      {/* Tabela */}
      {!loading && !error && (
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
