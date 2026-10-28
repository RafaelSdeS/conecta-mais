/**
 * Header — barra de controles do cenário.
 *
 * Contém:
 *  - Slider de orçamento (R$ 5–150 mi)
 *  - 3 toggles de alavanca (FUST, TCU, ENEC)
 *  - Botão "Ligar / Desligar alavancas"
 *  - Botão "Aplicar cenário completo" (budget=80 + todas ON)
 *  - Botão "Buscar Ctrl K" → abre paleta de comandos
 *  - No mobile (<900px): tudo atrás de um "☰ Filtros" colapsável
 */

import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/useToast'

const LEVERS: { key: 'fust' | 'tcu' | 'enec'; label: string; title: string }[] = [
  {
    key:   'fust',
    label: 'Subsídio FUST/BNDES',
    title: 'TR + 1,25% a.a. no lugar do WACC de 14–16%',
  },
  {
    key:   'tcu',
    label: 'Backhaul Acordo TCU',
    title: '121 municípios com backhaul obrigatório: CapEx de backhaul zerado',
  },
  {
    key:   'enec',
    label: 'Receita âncora ENEC',
    title: 'R$ 1.200/mês por escola (B2G)',
  },
]

export default function Header() {
  const budget         = useAppStore((s) => s.budget)
  const levers         = useAppStore((s) => s.levers)
  const kpis           = useAppStore((s) => s.kpis)
  const setBudget      = useAppStore((s) => s.setBudget)
  const setLevers      = useAppStore((s) => s.setLevers)
  const setAllLevers   = useAppStore((s) => s.setAllLevers)
  const setCmdPalette  = useAppStore((s) => s.setCmdPaletteOpen)

  const { toast } = useToast()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const allOn = Object.values(levers).every(Boolean)

  function handleLeverChange(key: 'fust' | 'tcu' | 'enec', checked: boolean) {
    setLevers({ [key]: checked })
    const lev = LEVERS.find((l) => l.key === key)!
    const viav = kpis?.municipiosViaveis ?? 0
    toast(`${lev.label} ${checked ? 'ligada' : 'desligada'} — ${viav} municípios viáveis`)
  }

  function handleApplyAll() {
    setBudget(80)
    setAllLevers(true)
    const viav = kpis?.municipiosViaveis ?? 0
    toast(`Orçamento de R$ 80 mi e todas as alavancas ligadas — ${viav} municípios viáveis`)
  }

  function handleToggleAll() {
    const nextOn = !allOn
    setAllLevers(nextOn)
    const viav = kpis?.municipiosViaveis ?? 0
    toast(`Alavancas ${nextOn ? 'ligadas' : 'desligadas'} — ${viav} municípios viáveis`)
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
          max={150}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          style={{ width: 180, accentColor: 'var(--ac)' }}
        />
      </div>

      {/* Alavancas */}
      <fieldset
        aria-label="Alavancas"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', border: 0, padding: 0, margin: 0, alignItems: 'center' }}
      >
        {LEVERS.map(({ key, label, title }) => {
          const checked = levers[key]
          return (
            <label
              key={key}
              title={title}
              style={{
                ...btnBase,
                gap: 8,
                border: `1px solid ${checked ? 'var(--ac)' : 'var(--ln)'}`,
                background: checked ? 'var(--so)' : 'transparent',
                transition: 'border-color .15s, background .15s',
                userSelect: 'none',
                color: 'var(--tx)',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => handleLeverChange(key, e.target.checked)}
                style={{ accentColor: 'var(--ac)', width: 16, height: 16, margin: 0, cursor: 'pointer', flexShrink: 0 }}
              />
              {label}
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

      <button
        onClick={handleApplyAll}
        className="btn-shimmer"
        style={{
          ...btnBase,
          background: 'var(--ac)',
          color: 'var(--on)',
          border: '1px solid var(--ac)',
        }}
      >
        Aplicar cenário completo
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
