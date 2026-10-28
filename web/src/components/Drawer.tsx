/**
 * Drawer — painel lateral deslizante (ficha executiva por município).
 * Abre pela direita, fecha com overlay, botão ou Esc.
 */

import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import DrawerContent from './DrawerContent'

export default function Drawer() {
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  const selectedId = useAppStore((s) => s.selectedId)
  const municipios = useAppStore((s) => s.municipios)
  const closeDrawer = useAppStore((s) => s.closeDrawer)

  const closeRef = useRef<HTMLButtonElement>(null)

  const municipio = municipios.find((m) => m.id_municipio === selectedId) ?? null

  // Foca no botão fechar ao abrir
  useEffect(() => {
    if (drawerOpen) closeRef.current?.focus()
  }, [drawerOpen])

  // Fecha com Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) closeDrawer()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drawerOpen, closeDrawer])

  return (
    <>
      {/* Overlay */}
      <div
        onClick={closeDrawer}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.4)',
          zIndex: 30,
          display: drawerOpen ? 'block' : 'none',
        }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(580px, 100%)',
          background: 'var(--pn)',
          borderLeft: '1px solid var(--ln)',
          zIndex: 31,
          overflowY: 'auto',
          padding: '20px 24px',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .2s ease',
        }}
      >
        {/* Cabeçalho do drawer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 12,
        }}>
          <b style={{ fontSize: 13 }}>Ficha executiva</b>
          <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => window.print()}
              className="no-print"
              style={{
                font: 'inherit',
                fontSize: 13,
                borderRadius: 4,
                padding: '5px 10px',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--tx)',
                border: '1px solid var(--ln)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--so)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Imprimir / PDF
            </button>
            <button
              ref={closeRef}
              onClick={closeDrawer}
              style={{
                font: 'inherit',
                fontSize: 13,
                borderRadius: 4,
                padding: '5px 10px',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--tx)',
                border: '1px solid var(--ln)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--so)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Fechar
            </button>
          </span>
        </div>

        {/* Conteúdo */}
        {municipio ? (
          <DrawerContent municipio={municipio} />
        ) : (
          <p style={{ color: 'var(--mu)', fontSize: 13 }}>
            Município não encontrado.
          </p>
        )}
      </aside>
    </>
  )
}
