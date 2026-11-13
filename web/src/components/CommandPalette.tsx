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
import { api, type FinanceiroLinha, type Municipio } from '../api/client'
import { VIEWS } from '../utils/constants'
import { useToast } from '../hooks/toastContext'

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
  const open       = useAppStore((s) => s.cmdPaletteOpen)
  const setOpen    = useAppStore((s) => s.setCmdPaletteOpen)
  const municipios = useAppStore((s) => s.municipios)
  const financeiro = useAppStore((s) => s.financeiro)
  const openDrawer = useAppStore((s) => s.openDrawer)

  const close = useCallback(() => setOpen(false), [setOpen])

  // Fecha com Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, close])

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

      {/* Modal — PaletteBody remontado a cada abertura (open: false→true),
          garantindo que query/active iniciam zerados sem setState em useEffect */}
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
        <PaletteBody
          municipios={municipios}
          financeiro={financeiro}
          onNavigate={onNavigate}
          onApplyAll={onApplyAll}
          onClose={close}
          openDrawer={openDrawer}
        />
      </div>
    </>
  )
}

// ── Corpo do modal extraído para componente separado ─────────────────────────
// Como CommandPalette retorna null quando fechado, este componente é
// remontado a cada abertura — os estados query e active inicializam
// corretamente sem precisar de useEffect com setState.

interface PaletteBodyProps {
  municipios:  Municipio[]
  financeiro:  Record<string, FinanceiroLinha>
  onNavigate:  (viewId: string) => void
  onApplyAll:  () => void
  onClose:     () => void
  openDrawer:  (id: string) => void
}

function PaletteBody({
  municipios,
  financeiro,
  onNavigate,
  onApplyAll,
  onClose,
  openDrawer,
}: PaletteBodyProps) {
  const setFilters          = useAppStore((s) => s.setFilters)
  const { toast }           = useToast()
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const listRef             = useRef<HTMLDivElement>(null)

  // Constrói lista de itens
  const items: PaletteItem[] = []
  const q = query.toLowerCase().trim()

  // Views
  VIEWS.forEach((v) => {
    const label = `Ir para ${v.label}`
    if (!q || label.toLowerCase().includes(q)) {
      items.push({ label, description: 'Página', action: () => { onNavigate(v.id); onClose() } })
    }
  })

  // Ação rápida
  const actionLabel = 'Aplicar cenário completo'
  if (!q || actionLabel.toLowerCase().includes(q)) {
    items.push({ label: actionLabel, description: 'Ação', action: () => { onApplyAll(); onClose() } })
  }

  // Municípios (só quando há texto digitado)
  if (q) {
    municipios
      .filter((m) => m.nome.toLowerCase().includes(q))
      .slice(0, 8)
      .forEach((m) => {
        const pay = financeiro[m.id_municipio]?.payback
        items.push({
          label:       m.nome,
          description: `${m.uf} · ${m.quadrante}${pay != null ? ` · ${pay.toFixed(1)} anos` : ''}`,
          action:      () => { openDrawer(m.id_municipio); onClose() },
        })
      })
  }

  // Texto livre → filtros via IBM Granite
  if (q.length >= 3) {
    items.push({
      label: `Pedir à IA: “${query.trim()}”`,
      description: 'Filtros por linguagem natural',
      action: () => {
        onClose()
        toast('Interpretando o pedido com IA…')
        api.postFiltros(query.trim())
          .then((f) => {
            setFilters({
              uf: f.uf ?? '',
              quadrante: f.quadrante ?? '',
              search: f.busca ?? '',
              portfolioOnly: f.apenas_portfolio,
            })
            onNavigate('mun')
            toast('Filtros aplicados na tela Municípios')
          })
          .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e)))
      },
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

  return (
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
      <input
        autoFocus // foca já na montagem: quem digita logo após o Ctrl+K não perde as primeiras letras
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
  )
}
