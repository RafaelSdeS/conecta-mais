/**
 * DrawerContent — conteúdo da ficha executiva de um município.
 * Renderiza diagnóstico, plano de ação e business case comparativo.
 *
 * Business case: chama POST /financial com e sem alavancas. Se a API estiver
 * offline, cai no modelo local (calcFinancial) para não quebrar em dev.
 */

import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { FinancialResult } from '../api/client'
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

const DEFAULT_PARAMS = {
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

// Converte FinancialResult da API para o formato da tabela local
interface BCRow { capex: number; back: number; b2c: number; b2g: number; ebitda: number; pay: number }

function apiResultToRow(r: FinancialResult): BCRow {
  return {
    capex:  r.capex.total,
    back:   r.capex.backhaul,
    b2c:    r.receita_anual,
    b2g:    0, // receita_anual já inclui B2G; separação requer endpoint futuro
    ebitda: r.ebitda_anual,
    pay:    r.payback_anos,
  }
}

export default function DrawerContent({ municipio: m }: Props) {
  const levers     = useAppStore((s) => s.levers)
  const portfolio  = useAppStore((s) => s.portfolio)
  const [favs, toggleFav] = useFavorites()
  const { toast } = useToast()

  // ── Business case via API ────────────────────────────────────────────────────
  const [bcBase, setBcBase]       = useState<BCRow | null>(null)
  const [bcWith, setBcWith]       = useState<BCRow | null>(null)
  const [bcLoading, setBcLoading] = useState(false)
  const [sensitivity, setSensitivity] = useState<{ adesao_pct: number; payback_anos: number }[]>([])

  // Fallback local (usado quando API offline)
  const dist    = m.dist_backhaul_km ?? 50
  const homes   = m.domicilios_urbanos ?? 5000
  const schools = m.escolas_sem_internet_aprendizagem ?? 0
  const tcuMun  = m.acordo_migracao ?? false
  const noLevers = { fust: false, tcu: false, enec: false }
  const fallbackBase = calcFinancial(homes, dist, schools, tcuMun, noLevers)
  const fallbackWith = calcFinancial(homes, dist, schools, tcuMun, levers)

  useEffect(() => {
    setBcLoading(true)
    setBcBase(null)
    setBcWith(null)
    setSensitivity([])

    const alavancasSem = { backhaul_comprometido: false, fust_reembolsavel: false, receita_escolar: false }
    const alavancasCom = {
      backhaul_comprometido: levers.tcu && tcuMun,
      fust_reembolsavel:     levers.fust,
      receita_escolar:       levers.enec,
    }

    Promise.all([
      api.postFinancial(m.id_municipio, DEFAULT_PARAMS, alavancasSem),
      api.postFinancial(m.id_municipio, DEFAULT_PARAMS, alavancasCom),
    ])
      .then(([resBase, resWith]) => {
        setBcBase(apiResultToRow(resBase))
        setBcWith(apiResultToRow(resWith))
        setSensitivity(resWith.sensitivity)
      })
      .catch(() => {
        // API offline — usa modelo local como fallback silencioso
        setBcBase(fallbackBase)
        setBcWith(fallbackWith)
      })
      .finally(() => setBcLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id_municipio, levers.fust, levers.tcu, levers.enec])

  // Valores a exibir: API real ou fallback
  const base    = bcBase  ?? fallbackBase
  const withLev = bcWith  ?? fallbackWith

  const tech       = getTechRecommendation(dist, homes)
  const professors = Math.round((m.escolas_sem_internet_aprendizagem ?? 2) * 3.7)
  const isFav      = favs.has(m.id_municipio)
  const isSel      = portfolio.some((p) => p.id_municipio === m.id_municipio)

  function handleFav() {
    toggleFav(m.id_municipio)
    toast(isFav ? 'Município removido dos favoritos' : 'Município adicionado aos favoritos')
  }

  const BC_ROWS: { label: string; key: keyof BCRow }[] = [
    { label: 'CapEx total',      key: 'capex'  },
    { label: 'Backhaul',         key: 'back'   },
    { label: 'Receita/ano',      key: 'b2c'    },
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
      <h3>
        Business case
        {bcLoading && (
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--mu)' }}>
            calculando…
          </span>
        )}
      </h3>
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

      {/* Sensibilidade à adesão (apenas quando API retorna) */}
      {sensitivity.length > 0 && (
        <>
          <h3 style={{ marginTop: 14, marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--mu)' }}>
            Sensibilidade à adesão
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sensitivity.length}, 1fr)`, gap: 8 }}>
            {sensitivity.map((row) => (
              <div
                key={row.adesao_pct}
                style={{
                  textAlign: 'center',
                  border: '1px solid var(--ln)',
                  borderRadius: 4,
                  padding: '8px 4px',
                  background: 'var(--so)',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtAnos(row.payback_anos)}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{(row.adesao_pct * 100).toFixed(0)}% adesão</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
