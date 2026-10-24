import { useState } from 'react'
import ScoreMap from './pages/ScoreMap'
import Simulator from './pages/Simulator'

type View = 'painel' | 'simulador'

const NAV: { id: View; label: string }[] = [
  { id: 'painel',    label: 'Painel' },
  { id: 'simulador', label: 'Simulador' },
]

export default function App() {
  const [view, setView] = useState<View>('painel')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '208px 1fr', minHeight: '100svh' }}>

      {/* Sidebar */}
      <aside style={{
        position: 'sticky', top: 0, height: '100vh',
        background: 'var(--pn)', borderRight: '1px solid var(--ln)',
        padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            Conecta<span style={{ color: 'var(--ac)' }}>+</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--mu)' }}>Expansão de conectividade</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              style={{
                font: 'inherit', textAlign: 'left',
                background: view === n.id ? 'var(--so)' : 'none',
                border: 0, borderRadius: 4, padding: '8px 10px', cursor: 'pointer',
                color: view === n.id ? 'var(--tx)' : 'var(--mu)',
                fontWeight: view === n.id ? 500 : 400,
                boxShadow: view === n.id ? 'inset 3px 0 0 var(--ac)' : 'none',
              } as React.CSSProperties}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <p style={{ marginTop: 'auto', fontSize: 11, color: 'var(--mu)' }}>
          Protótipo com dados simulados.<br />
          IBM SkillsBuild & Fundação Telefônica Vivo.
        </p>
      </aside>

      {/* Conteúdo principal */}
      <main style={{ padding: 24, maxWidth: 1320 }}>
        {view === 'painel'    && <ScoreMap />}
        {view === 'simulador' && <Simulator />}
      </main>
    </div>
  )
}
