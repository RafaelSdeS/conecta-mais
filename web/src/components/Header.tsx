/**
 * Header — barra do cenário.
 *
 * Orçamento · escopo (vem dos filtros) · objetivo · premissas · alavancas.
 * Tudo recalcula no backend (portfólio, tabela, mapa, ficha e chat usam o mesmo cenário).
 * No mobile (<900px): tudo atrás de um "☰ Filtros" colapsável.
 */

import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/toastContext'
import AssumptionsPanel from './AssumptionsPanel'
import { OBJETIVOS } from '../utils/constants'

const LEVERS: { key: 'fust' | 'tcu' | 'enec'; label: string; title: string; campo?: string }[] = [
  {
    key:   'fust',
    label: 'Subsídio FUST/BNDES',
    title: 'Cenário: financiamento FUST/BNDES (custo de capital de 3,25% a.a. no lugar do WACC). Melhora o VPL; não altera o payback simples.',
  },
  {
    key:   'tcu',
    label: 'Backhaul Acordo TCU',
    title: 'Zera o CapEx de backhaul dos municípios do Acordo TCU/Anatel.',
    campo: 'acordo_migracao',
  },
  {
    key:   'enec',
    label: 'Receita âncora ENEC',
    title: 'Receita B2G de R$ 1.200/mês por escola sem internet para aprendizagem (premissa editável).',
  },
]

export default function Header() {
  const budget         = useAppStore((s) => s.budget)
  const levers         = useAppStore((s) => s.levers)
  const filters        = useAppStore((s) => s.filters)
  const objetivo       = useAppStore((s) => s.objetivo)
  const setObjetivo    = useAppStore((s) => s.setObjetivo)
  const qualidade      = useAppStore((s) => s.qualidade)
  const setBudget      = useAppStore((s) => s.setBudget)
  const setLevers      = useAppStore((s) => s.setLevers)
  const setCmdPalette  = useAppStore((s) => s.setCmdPaletteOpen)

  const { toast } = useToast()
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Alavanca sem dados reais (campo neutro no ETL) não tem efeito: fica desabilitada.
  const semDados = (campo?: string) =>
    !!campo && qualidade.some((q) => q.campo === campo && q.tipo === 'neutro')
  const disponiveis = LEVERS.filter((l) => !semDados(l.campo))
  const allOn = disponiveis.every((l) => levers[l.key])

  const escopo = [
    filters.uf, filters.regiao, filters.semiarido ? 'Semiárido' : '',
  ].filter(Boolean).join(' · ') || 'Brasil'

  // O aviso explica a alavanca/objetivo: o `title` não aparece em tela de toque.
  // Os KPIs só mudam depois do recálculo no servidor, então o aviso não traz números.
  function handleLeverChange(key: 'fust' | 'tcu' | 'enec', checked: boolean) {
    setLevers({ [key]: checked })
    const lev = LEVERS.find((l) => l.key === key)!
    if (checked) toast(`${lev.label} ligada. ${lev.title}`, 6000)
    else toast(`${lev.label} desligada. Recalculando o portfólio…`)
  }

  function handleToggleAll() {
    const nextOn = !allOn
    disponiveis.forEach((l) => setLevers({ [l.key]: nextOn }))
    toast(`Alavancas ${nextOn ? 'ligadas' : 'desligadas'}. Recalculando o portfólio…`)
  }

  // Estilo base compartilhado por todos os botões do header
  const btnBase: React.CSSProperties = {
    font: 'inherit',
    fontSize: 13,
    lineHeight: '1',
    borderRadius: 4,
    padding: '6px 12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    height: 32,
    boxSizing: 'border-box',
  }

  const controls = (
    <>
      {/* Orçamento */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label htmlFor="budget" style={{ fontSize: 12, color: 'var(--mu)', whiteSpace: 'nowrap' }}>
          Orçamento de CapEx
        </label>
        <output style={{ fontWeight: 600, minWidth: 64, fontSize: 13 }}>
          R$ {budget} mi
        </output>
        <input
          type="range"
          id="budget"
          min={5}
          max={500}
          step={5}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          style={{ width: 180, accentColor: 'var(--ac)' }}
        />
      </div>

      {/* Escopo (definido pelos filtros) */}
      <span
        title="O portfólio é calculado dentro do escopo escolhido nos filtros (UF, região, Semiárido)"
        style={{ ...btnBase, border: '1px dashed var(--ln)', color: 'var(--mu)', gap: 6 }}
      >
        Escopo: <b style={{ color: 'var(--tx)' }}>{escopo}</b>
      </span>

      {/* Objetivo do portfólio */}
      <div role="radiogroup" aria-label="Objetivo do portfólio" style={{ display: 'flex' }}>
        {OBJETIVOS.map((o, i) => {
          const on = objetivo === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              title={o.title}
              onClick={() => {
                setObjetivo(o.value)
                toast(`Objetivo ${o.label}. ${o.title}.`, 4000)
              }}
              style={{
                ...btnBase,
                borderRadius: i === 0 ? '4px 0 0 4px' : i === OBJETIVOS.length - 1 ? '0 4px 4px 0' : 0,
                marginLeft: i === 0 ? 0 : -1,
                border: `1px solid ${on ? 'var(--ac)' : 'var(--ln)'}`,
                background: on ? 'var(--so)' : 'transparent',
                color: 'var(--tx)',
                position: 'relative',
                zIndex: on ? 1 : 0,
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      <AssumptionsPanel buttonStyle={btnBase} />

      {/* Alavancas */}
      <fieldset
        aria-label="Alavancas"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', border: 0, padding: 0, margin: 0, alignItems: 'center' }}
      >
        {LEVERS.map(({ key, label, title, campo }) => {
          const off = semDados(campo)
          const checked = levers[key] && !off
          return (
            <label
              key={key}
              title={off ? `Sem dados: a lista de municípios (${campo}) não está carregada no ETL, então a alavanca não tem efeito.` : title}
              style={{
                ...btnBase,
                gap: 8,
                border: `1px solid ${checked ? 'var(--ac)' : 'var(--ln)'}`,
                background: checked ? 'var(--so)' : 'transparent',
                transition: 'border-color .15s, background .15s',
                userSelect: 'none',
                color: off ? 'var(--mu)' : 'var(--tx)',
                opacity: off ? 0.6 : 1,
                cursor: off ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={off}
                onChange={(e) => handleLeverChange(key, e.target.checked)}
                style={{ accentColor: 'var(--ac)', width: 16, height: 16, margin: 0, cursor: off ? 'not-allowed' : 'pointer', flexShrink: 0 }}
              />
              {label}{off ? ' (sem dados)' : ''}
            </label>
          )
        })}
      </fieldset>

      {/* Ações */}
      <button
        onClick={handleToggleAll}
        style={{
          ...btnBase,
          background: 'transparent',
          color: 'var(--tx)',
          border: '1px solid var(--ln)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--so)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {allOn ? 'Desligar alavancas' : 'Ligar alavancas'}
      </button>
    </>
  )

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--pn)',
        borderBottom: '1px solid var(--ln)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {/* Lado esquerdo: mobile toggle + controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>

        {/* Mobile toggle */}
        <button
          id="fTog"
          aria-expanded={filtersOpen}
          aria-controls="fBox"
          onClick={() => setFiltersOpen((o) => !o)}
          style={{
            font: 'inherit',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--tx)',
            border: '1px solid var(--ln)',
            display: 'none',
          }}
          className="header-mobile-toggle"
        >
          {filtersOpen ? '✕ Fechar filtros' : '☰ Filtros'}
        </button>

        {/* Controles */}
        <div
          id="fBox"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px 20px',
            alignItems: 'center',
          }}
          className={`header-controls${filtersOpen ? ' open' : ''}`}
        >
          {controls}
        </div>
      </div>

      {/* Lado direito: Buscar — alinhado ao topo da primeira linha */}
      <button
        onClick={() => setCmdPalette(true)}
        style={{
          ...btnBase,
          background: 'transparent',
          color: 'var(--tx)',
          border: '1px solid var(--ln)',
          gap: 6,
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--so)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        Buscar
        <span
          style={{
            fontSize: 11,
            border: '1px solid var(--ln)',
            borderRadius: 3,
            padding: '0 5px',
            color: 'var(--mu)',
          }}
        >
          Ctrl K
        </span>
      </button>
    </header>
  )
}
