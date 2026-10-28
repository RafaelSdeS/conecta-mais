/**
 * DrawerContent — conteúdo da ficha executiva de um município.
 * Renderiza diagnóstico, plano de ação e business case comparativo.
 */

import { useAppStore } from '../store/appStore'
import { useFavorites } from '../hooks/useFavorites'
import { useToast } from '../hooks/useToast'
import QuadrantBadge from './QuadrantBadge'
import { QUADRANT_NAMES } from '../utils/constants'
import { fmtMi, fmtAnos, fmtN0 } from '../utils/format'
import { getTechRecommendation, calcFinancial } from '../utils/calculation'
import type { Municipio } from '../api/client'

interface Props {
  municipio: Municipio
}

const btnGhost: React.CSSProperties = {
  font: 'inherit',
  fontSize: 13,
  borderRadius: 4,
  padding: '5px 10px',
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--tx)',
  border: '1px solid var(--ln)',
}

export default function DrawerContent({ municipio: m }: Props) {
  const levers     = useAppStore((s) => s.levers)
  const portfolio  = useAppStore((s) => s.portfolio)
  const [favs, toggleFav] = useFavorites()
  const { toast } = useToast()

  const isFav     = favs.has(m.id_municipio)
  const isSel     = portfolio.some((p) => p.id_municipio === m.id_municipio)
  const dist      = m.dist_backhaul_km ?? 50
  const homes     = m.domicilios_urbanos ?? 5000
  const schools   = m.escolas_sem_internet_aprendizagem ?? 0
  const tcuMun    = m.acordo_migracao ?? false

  const noLevers  = { fust: false, tcu: false, enec: false }
  const base      = calcFinancial(homes, dist, schools, tcuMun, noLevers)
  const withLev   = calcFinancial(homes, dist, schools, tcuMun, levers)

  const tech      = getTechRecommendation(dist, homes)
  const professors = Math.round((m.escolas_sem_internet_aprendizagem ?? 2) * 3.7)

  function handleFav() {
    toggleFav(m.id_municipio)
    toast(isFav ? 'Município removido dos favoritos' : 'Município adicionado aos favoritos')
  }

  const BC_ROWS: { label: string; key: keyof typeof base }[] = [
    { label: 'CapEx total',      key: 'capex'  },
    { label: 'Backhaul',         key: 'back'   },
    { label: 'Receita B2C/ano',  key: 'b2c'    },
    { label: 'Receita B2G/ano',  key: 'b2g'    },
    { label: 'EBITDA/ano',       key: 'ebitda' },
  ]

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h2 id="drawer-title" style={{ fontSize: 18, margin: 0 }}>
          {m.nome} / {m.uf}
        </h2>
        <button
          onClick={handleFav}
          aria-pressed={isFav}
          style={btnGhost}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--so)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {isFav ? '★ Favorito' : '☆ Favoritar'}
        </button>
      </div>

      <QuadrantBadge quadrante={m.quadrante} showLabel />
      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--mu)' }}>
        · {QUADRANT_NAMES[m.quadrante]}
      </span>

      {/* Diagnóstico */}
      <h3>Diagnóstico</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '4px 12px', margin: 0, fontSize: 13 }}>
        <dt style={{ color: 'var(--mu)' }}>População</dt>
        <dd style={{ margin: 0 }}>{fmtN0(homes * 3.4 / 0.8)} hab. · {fmtN0(homes)} domicílios urbanos</dd>

        <dt style={{ color: 'var(--mu)' }}>Escolas públicas</dt>
        <dd style={{ margin: 0 }}>
          {fmtN0(m.matriculas_publicas ?? 0)} matrículas
          {schools > 0 ? ` · ${schools} sem internet` : ''}
        </dd>

        <dt style={{ color: 'var(--mu)' }}>PoP de fibra</dt>
        <dd style={{ margin: 0 }}>{dist} km</dd>

        <dt style={{ color: 'var(--mu)' }}>Base móvel Vivo</dt>
        <dd style={{ margin: 0 }}>{((m.market_share_vivo_movel ?? 0) * 100).toFixed(0)}%</dd>

        <dt style={{ color: 'var(--mu)' }}>Scores</dt>
        <dd style={{ margin: 0 }}>
          M {m.score_M?.toFixed(0) ?? '—'} · I {m.score_I?.toFixed(0) ?? '—'} · C {m.score_C?.toFixed(0) ?? '—'} · A {m.score_A?.toFixed(0) ?? '—'}
        </dd>

        <dt style={{ color: 'var(--mu)' }}>Acordo TCU</dt>
        <dd style={{ margin: 0 }}>{tcuMun ? 'Sim' : 'Não'}</dd>

        <dt style={{ color: 'var(--mu)' }}>FUST elegível</dt>
        <dd style={{ margin: 0 }}>{m.fust_elegivel ? 'Sim' : 'Não'}</dd>
      </dl>

      {/* Plano de ação */}
      <h3>Plano de ação</h3>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        <li><b>Tecnologia:</b> {tech}</li>
        <li>
          <b>Financiamento:</b>{' '}
          {levers.fust ? 'FUST/BNDES (TR + 1,25% a.a.)' : 'WACC privado'}
          {tcuMun && levers.tcu ? ' e backhaul TCU' : ''}
        </li>
        <li>
          <b>Fundação Telefônica:</b> Escolas Conectadas, formação de ~{professors} professores da rede municipal
        </li>
        <li>
          <b>Portfólio:</b>{' '}
          <span style={{ color: isSel ? 'var(--ok)' : 'var(--mu)', fontWeight: isSel ? 600 : 400 }}>
            {isSel ? 'Selecionado' : 'Fora do orçamento atual'}
          </span>
        </li>
      </ul>

      {/* Business case */}
      <h3>Business case</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--ln)', color: 'var(--mu)', fontWeight: 500, fontSize: 12 }} />
              <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--ln)', color: 'var(--mu)', fontWeight: 500, fontSize: 12 }}>Sem alavancas</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--ln)', color: 'var(--mu)', fontWeight: 500, fontSize: 12 }}>Com alavancas</th>
            </tr>
          </thead>
          <tbody>
            {BC_ROWS.map(({ label, key }) => (
              <tr key={key}>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--ln)', color: 'var(--mu)' }}>{label}</td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--ln)', textAlign: 'right' }}>{fmtMi(base[key])}</td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--ln)', textAlign: 'right' }}>{fmtMi(withLev[key])}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '5px 8px', fontWeight: 600 }}>Payback</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{fmtAnos(base.pay)}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: withLev.pay <= 6 ? 'var(--ok)' : 'var(--tx)' }}>
                {fmtAnos(withLev.pay)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
