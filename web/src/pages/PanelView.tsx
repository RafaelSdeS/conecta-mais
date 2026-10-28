/**
 * PanelView — view principal com KPIs, mapa, quadrantes e histograma.
 */

import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import KPIPanel          from '../components/KPIPanel'
import MapContainer      from '../components/MapContainer'
import QuadrantButtons   from '../components/QuadrantButtons'
import PaybackHistogram  from '../components/PaybackHistogram'
import { calcFinancial } from '../utils/calculation'

export default function PanelView() {
  const municipios  = useAppStore((s) => s.municipios)
  const portfolio   = useAppStore((s) => s.portfolio)
  const levers      = useAppStore((s) => s.levers)
  const kpis        = useAppStore((s) => s.kpis)
  const openDrawer  = useAppStore((s) => s.openDrawer)

  const portfolioIds = useMemo(
    () => new Set(portfolio.map((m) => m.id_municipio)),
    [portfolio]
  )

  // Paybacks calculados por município usando o modelo financeiro local.
  // Mostra todos os municípios no histograma para dar visão da distribuição.
  const paybacks = useMemo(() => {
    if (municipios.length === 0) return []
    return municipios.map((m) =>
      calcFinancial(
        m.domicilios_urbanos ?? 5000,
        m.dist_backhaul_km ?? 50,
        m.escolas_sem_internet_aprendizagem ?? 0,
        m.acordo_migracao ?? false,
        levers,
      ).pay
    )
  }, [municipios, levers])

  const totalMunicipios = municipios.length || 417

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 16 }}>
        <h1>Expansão na Bahia: {totalMunicipios} municípios</h1>
        <p style={{ color: 'var(--mu)' }}>
          Ajuste o orçamento e as alavancas acima. O mapa, os quadrantes e o portfólio recalculam em seguida.
        </p>
      </div>

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

          <QuadrantButtons municipios={municipios} />

          {/* Stats viáveis / migração */}
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '7px 0',
              borderTop: '1px solid var(--ln)',
              fontSize: 13,
            }}>
              <span>Viáveis (payback até 6 anos)</span>
              <b>{kpis?.municipiosViaveis ?? '—'}</b>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '7px 0',
              borderTop: '1px solid var(--ln)',
              fontSize: 13,
            }}>
              <span>Migraram de Q2b para Q2a</span>
              <b>{kpis?.migracoes ?? '—'}</b>
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
