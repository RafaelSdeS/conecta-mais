import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { VIEWS, type ViewId } from './utils/constants'
import { ToastProvider } from './hooks/useToast'
import { useToast } from './hooks/useToast'
import { usePortfolioTrigger } from './hooks/usePortfolioTrigger'
import { useInitialData }      from './hooks/useInitialData'

import logoTexto       from './assets/logo-texto.svg'
import logoTextoBranca from './assets/logo-texto-branca.svg'

import PanelView    from './pages/PanelView'
import MunView      from './pages/MunView'
import ChatView     from './pages/ChatView'
import SolutionView from './pages/SolutionView'

import Header          from './components/Header'
import Drawer          from './components/Drawer'
import CommandPalette  from './components/CommandPalette'
import Toast           from './components/Toast'

const VIEW_COMPONENTS: Record<ViewId, React.ComponentType> = {
  painel: PanelView,
  mun:    MunView,
  chat:   ChatView,
  sol:    SolutionView,
}

export default function App() {
  const theme    = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  // Sincroniza data-theme no <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else                  root.setAttribute('data-theme', 'light')
  }, [theme])

  return (
    <ToastProvider>
      <AppInner theme={theme} setTheme={setTheme} />
    </ToastProvider>
  )
}

// ── Inner — tem acesso ao ToastProvider ───────────────────────────────────────
function AppInner({
  theme,
  setTheme,
}: {
  theme: string
  setTheme: (t: 'light' | 'dark') => void
}) {
  const setCmdPalette  = useAppStore((s) => s.setCmdPaletteOpen)
  const cmdOpen        = useAppStore((s) => s.cmdPaletteOpen)
  const setBudget      = useAppStore((s) => s.setBudget)
  const setAllLevers   = useAppStore((s) => s.setAllLevers)
  const kpis           = useAppStore((s) => s.kpis)
  const { toast }      = useToast()

  const [currentView, setCurrentView] = useState<ViewId>('painel')

  // Carrega municípios na inicialização
  useInitialData()

  // Dispara POST /portfolio sempre que budget ou levers mudam
  usePortfolioTrigger()

  // Atalho global Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdPalette(!cmdOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cmdOpen, setCmdPalette])

  const handleApplyAll = useCallback(() => {
    setBudget(80)
    setAllLevers(true)
    const viav = kpis?.municipiosViaveis ?? 0
    toast(`Orçamento de R$ 80 mi e todas as alavancas ligadas — ${viav} municípios viáveis`)
  }, [setBudget, setAllLevers, kpis, toast])

  const CurrentPage = VIEW_COMPONENTS[currentView]

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '208px minmax(0, 1fr)',
          minHeight: '100svh',
        }}
        className="app-grid"
      >
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside
          className="app-sidebar"
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            background: 'var(--pn)',
            borderRight: '1px solid var(--ln)',
            padding: '20px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Brand */}
          <div style={{ flexShrink: 0 }}>
            <img
              src={theme === 'dark' ? logoTextoBranca : logoTexto}
              alt="Conecta+"
              style={{
                display: 'block',
                width: 130,
                height: 'auto',
              }}
            />
            <span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--mu)' }}>
              Expansão de conectividade
            </span>
          </div>

          {/* Navegação */}
          <nav aria-label="Navegação principal" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {VIEWS.map((v) => {
              const active = currentView === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => setCurrentView(v.id)}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    font: 'inherit',
                    textAlign: 'left',
                    background: active ? 'var(--so)' : 'none',
                    border: 0,
                    borderRadius: 4,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    color: active ? 'var(--tx)' : 'var(--mu)',
                    fontWeight: active ? 500 : 400,
                    boxShadow: active ? 'inset 3px 0 0 var(--ac)' : 'none',
                    transition: 'background .15s, color .15s',
                  }}
                >
                  {v.label}
                </button>
              )
            })}
          </nav>

          {/* Theme toggle + nota */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
              style={{
                font: 'inherit',
                fontSize: 11,
                background: 'none',
                border: '1px solid var(--ln)',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                color: 'var(--mu)',
                textAlign: 'left',
              }}
            >
              {theme === 'dark' ? '☀ Tema claro' : '☾ Tema escuro'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--mu)', margin: 0 }} className="sidebar-note">
              Protótipo com dados simulados.<br />
              IBM SkillsBuild &amp; Fundação Telefônica Vivo.
            </p>
          </div>
        </aside>

        {/* ── Área principal ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
          <Header />
          <main
            id="main-content"
            tabIndex={-1}
            style={{ padding: 24, flex: 1 }}
            aria-label={`Vista: ${VIEWS.find((v) => v.id === currentView)?.label}`}
          >
            <CurrentPage />
          </main>
        </div>
      </div>

      {/* Overlays globais */}
      <Drawer />
      <CommandPalette
        onNavigate={(id) => setCurrentView(id as ViewId)}
        onApplyAll={handleApplyAll}
      />
      <Toast />
    </>
  )
}
