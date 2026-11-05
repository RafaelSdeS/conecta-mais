/**
 * PanelView — view principal com KPIs, mapa, quadrantes e histograma.
 */

import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { useFilteredMunicipios } from '../hooks/useFilteredMunicipios'
import FilterBar from '../components/FilterBar'
import KPIPanel          from '../components/KPIPanel'
import MapContainer      from '../components/MapContainer'
import QuadrantButtons   from '../components/QuadrantButtons'
import PaybackHistogram  from '../components/PaybackHistogram'
import { fmtN0 } from '../utils/format'
import { imprimir } from '../utils/imprimir'

export default function PanelView() {
  const todos       = useAppStore((s) => s.municipios)
  const portfolio   = useAppStore((s) => s.portfolio)
  const financeiro  = useAppStore((s) => s.financeiro)
  const openDrawer  = useAppStore((s) => s.openDrawer)
  const kpis        = useAppStore((s) => s.kpis)

  const municipios  = useFilteredMunicipios()
  const paraQuadrantes = useFilteredMunicipios('quadrante')

  const portfolioIds = useMemo(
    () => new Set(portfolio.map((m) => m.id_municipio)),
    [portfolio]
  )

  // Payback de cada município do recorte, calculado pelo backend no cenário atual.
  const paybacks = useMemo(
    () =>
      municipios
        .map((m) => financeiro[m.id_municipio]?.payback)
        .filter((p): p is number => p != null),
    [municipios, financeiro],
  )
  const viaveis = paybacks.filter((p) => p <= 6).length
  const alunos  = useMemo(() => municipios.reduce((s, m) => s + (m.alunos_sem_internet ?? 0), 0), [municipios])

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>Expansão da conectividade: {municipios.length} de {todos.length} municípios</h1>
          <p style={{ color: 'var(--mu)' }}>
            Ajuste o cenário no topo e os filtros abaixo: mapa, quadrantes, histograma e portfólio respondem juntos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => imprimir('imprimindo-dossie')}
          disabled={!kpis}
          title="Cenário, plano, decisões registradas e limites dos dados do recorte, prontos para o comitê"
          style={{
            font: 'inherit', fontSize: 13, borderRadius: 4, padding: '8px 12px', cursor: kpis ? 'pointer' : 'not-allowed',
            background: 'transparent', color: 'var(--tx)', border: '1px solid var(--ln)', opacity: kpis ? 1 : 0.6,
          }}
        >
          Dossiê (PDF)
        </button>
      </div>

      <FilterBar />

      {/* KPIs */}
      <KPIPanel />

      {/* Grid: mapa (esq) + painel direito */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Mapa */}
        <div
          style={{
            background: 'var(--pn)',
            border: '1px solid var(--ln)',
            borderRadius: 6,
            padding: 16,
          }}
        >
          <MapContainer
            municipios={municipios}
            portfolioIds={portfolioIds}
            onMunicipioClick={openDrawer}
          />
        </div>

        {/* Painel direito */}
        <div
          style={{
            background: 'var(--pn)',
            border: '1px solid var(--ln)',
            borderRadius: 6,
            padding: 16,
          }}
        >
          <h2 style={{ marginBottom: 12 }}>Quadrantes do Score Duplo 2.0</h2>

          <QuadrantButtons municipios={paraQuadrantes} />

          {/* Stats viáveis / migração */}
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '7px 0',
              borderTop: '1px solid var(--ln)',
              fontSize: 13,
            }}>
              <span>Viáveis no recorte (payback até 6 anos)</span>
              <b>{Object.keys(financeiro).length ? viaveis : '—'}</b>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '7px 0',
              borderTop: '1px solid var(--ln)',
              fontSize: 13,
            }}>
              <span>Alunos em escolas sem internet (recorte)</span>
              <b>{fmtN0(alunos)}</b>
            </div>
          </div>

          {/* Histograma */}
          <h3 style={{ marginTop: 16, marginBottom: 4 }}>
            Payback por município <span style={{ color: 'var(--mu)', fontWeight: 400 }}>(verde: até 6 anos)</span>
          </h3>
          <PaybackHistogram municipios={municipios} paybacks={paybacks} />

          {/* Legenda */}
          <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 12 }}>
            M potencial de mercado · I impacto educacional · C custo de implantação · A alavancagem financeira e regulatória.
            Clique em um quadrante para filtrar mapa e tabela.
          </p>
        </div>
      </div>
    </div>
  )
}
