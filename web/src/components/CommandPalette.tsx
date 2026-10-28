/**
 * CommandPalette — modal de busca rápida (Ctrl+K / Cmd+K).
 *
 * Itens disponíveis:
 *  - Navegar para as 4 views
 *  - Aplicar cenário completo
 *  - Abrir ficha de um município (busca por nome)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { VIEWS } from '../utils/constants'
import { calcFinancial } from '../utils/calculation'

interface PaletteItem {
  label:       string
  description: string
  action:      () => void
}

interface Props {
  /** Callback para mudar a view ativa — vem do App */
  onNavigate: (viewId: string) => void
  onApplyAll: () => void
}

export default function CommandPalette({ onNavigate, onApplyAll }: Props) {
  const open         = useAppStore((s) => s.cmdPaletteOpen)
  const setOpen      = useAppStore((s) => s.setCmdPaletteOpen)
  const municipios   = useAppStore((s) => s.municipios)
  const levers       = useAppStore((s) => s.levers)
  const openDrawer   = useAppStore((s) => s.openDrawer)

  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const inputRef            = useRef<HTMLInputElement>(null)
  const listRef             = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }, [setOpen])

  // Foca o input ao abrir
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Fecha com Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, close])

  // Constrói lista de itens
  const items: PaletteItem[] = []
  const q = query.toLowerCase().trim()

  // Views
  VIEWS.forEach((v) => {
    const label = `Ir para ${v.label}`
    if (!q || label.toLowerCase().includes(q)) {
      items.push({ label, description: 'Página', action: () => { onNavigate(v.id); close() } })
    }
  })

  // Ação rápida
  const actionLabel = 'Aplicar cenário completo'
  if (!q || actionLabel.toLowerCase().includes(q)) {
    items.push({ label: actionLabel, description: 'Ação', action: () => { onApplyAll(); close() } })
  }

  // Municípios (só quando há texto digitado)
  if (q) {
    municipios
      .filter((m) => m.nome.toLowerCase().includes(q))
      .slice(0, 8)
      .forEach((m) => {
        const calc = calcFinancial(
          m.domicilios_urbanos ?? 5000,
          m.dist_backhaul_km ?? 50,
          m.escolas_sem_internet_aprendizagem ?? 0,
          m.acordo_migracao ?? false,
          levers,
        )
        items.push({
          label:       m.nome,
          description: `${m.quadrante} · ${calc.pay.toFixed(1)} anos`,
          action:      () => { openDrawer(m.id_municipio); close() },
        })
      })
  }

  // Scroll automático para item ativo
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      items[active]?.action()
    }
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.4)',
          zIndex: 60,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 61,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '12vh',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 'min(520px, 92%)',
            background: 'var(--pn)',
            border: '1px solid var(--ln)',
            borderRadius: 8,
            overflow: 'hidden',
            pointerEvents: 'all',
            boxShadow: '0 8px 32px rgba(0,0,0,.2)',
          }}
        >
          {/* Input de busca */}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar município ou ir para…"
            aria-label="Buscar"
            style={{
              width: '100%',
              border: 0,
              borderBottom: '1px solid var(--ln)',
              borderRadius: 0,
              padding: '14px 16px',
              font: 'inherit',
              fontSize: 14,
              background: 'var(--pn)',
              color: 'var(--tx)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Lista de resultados */}
          <div
            ref={listRef}
            style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}
          >
            {items.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--mu)' }}>
                Nada encontrado. Tente outro nome.
              </div>
            ) : (
              items.map((item, i) => (
                <div
                  key={i}
                  onClick={item.action}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                    background: i === active ? 'var(--so)' : 'transparent',
                  }}
                >
                  <span>{item.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--mu)', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
