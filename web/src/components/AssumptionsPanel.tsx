/**
 * AssumptionsPanel — popover com as premissas financeiras do cenário (ARPU, adesão, margem, WACC…).
 * Mudanças recalculam portfólio, tabela, mapa e ficha no backend; o chat usa as mesmas premissas.
 */

import { useEffect, useRef, useState } from 'react'
import type { FinancialParams } from '../api/client'
import { useAppStore } from '../store/appStore'
import { DEFAULT_PARAMS } from '../utils/constants'

interface Campo {
  key: keyof FinancialParams
  label: string
  /** Guardado como fração (0,25) e exibido em % (25). */
  pct?: boolean
  step: number
  min: number
}

const CAMPOS: Campo[] = [
  { key: 'arpu_mensal',        label: 'ARPU residencial (R$/mês)', step: 1,    min: 1 },
  { key: 'adesao_pct',         label: 'Adesão em maturidade (%)',  step: 1,    min: 1, pct: true },
  { key: 'margem_ebitda',      label: 'Margem EBITDA (%)',         step: 1,    min: 1, pct: true },
  { key: 'wacc',               label: 'WACC privado (% a.a.)',     step: 0.5,  min: 0.5, pct: true },
  { key: 'wacc_fust',          label: 'WACC com FUST (% a.a.)',    step: 0.25, min: 0.25, pct: true },
  { key: 'custo_hp',           label: 'Custo de rede por domicílio (R$)', step: 10, min: 1 },
  { key: 'custo_backhaul_km',  label: 'Custo de backhaul por km (R$)',    step: 1000, min: 1 },
  { key: 'custo_ativacao',     label: 'Custo de ativação por cliente (R$)', step: 10, min: 1 },
  { key: 'arpu_escolar_mensal', label: 'ARPU por escola (R$/mês, alavanca ENEC)', step: 50, min: 1 },
]

const inputStyle: React.CSSProperties = {
  font: 'inherit',
  fontSize: 13,
  width: 90,
  textAlign: 'right',
  background: 'var(--pn)',
  color: 'var(--tx)',
  border: '1px solid var(--ln)',
  borderRadius: 4,
  padding: '4px 8px',
}

export default function AssumptionsPanel({ buttonStyle }: { buttonStyle: React.CSSProperties }) {
  const params      = useAppStore((s) => s.params)
  const setParams   = useAppStore((s) => s.setParams)
  const resetParams = useAppStore((s) => s.resetParams)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const alterado = CAMPOS.some((c) => params[c.key] !== DEFAULT_PARAMS[c.key])

  useEffect(() => {
    if (!open) return
    const fora = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...buttonStyle,
          background: alterado ? 'var(--so)' : 'transparent',
          border: `1px solid ${alterado ? 'var(--ac)' : 'var(--ln)'}`,
          color: 'var(--tx)',
        }}
        title="Premissas financeiras do cenário"
      >
        Premissas{alterado ? ' •' : ''}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Premissas financeiras"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 20,
            width: 340,
            background: 'var(--pn)',
            border: '1px solid var(--ln)',
            borderRadius: 6,
            padding: 14,
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          }}
        >
          <b style={{ fontSize: 13 }}>Premissas financeiras</b>
          <p style={{ fontSize: 12, color: 'var(--mu)', margin: '4px 0 10px' }}>
            Valem para o portfólio, a tabela, o mapa, a ficha e o chat. Com os padrões, o payback simples
            não cai abaixo de ~5,7 anos.
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            {CAMPOS.map((c) => (
              <label key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12 }}>
                {c.label}
                <input
                  type="number"
                  step={c.step}
                  min={c.min}
                  value={c.pct ? +((params[c.key] as number) * 100).toFixed(2) : (params[c.key] as number)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!Number.isFinite(v) || v < c.min) return
                    setParams({ [c.key]: c.pct ? v / 100 : v })
                  }}
                  style={inputStyle}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={resetParams}
            disabled={!alterado}
            style={{ ...buttonStyle, marginTop: 12, border: '1px solid var(--ln)', background: 'transparent', color: 'var(--tx)', opacity: alterado ? 1 : 0.5 }}
          >
            Restaurar padrão
          </button>
        </div>
      )}
    </div>
  )
}
