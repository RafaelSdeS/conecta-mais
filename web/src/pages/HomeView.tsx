/**
 * HomeView — tela de início do Conecta+
 * Fiel ao protótipo INICIO/conecta-inicio.html
 */
import React from 'react'

import logoTexto        from '../assets/logo-texto.svg'
import logoTextoBranca  from '../assets/logo-texto-branca.svg'
import { useAppStore }  from '../store/appStore'

interface HomeViewProps {
  onEnter: () => void
}

/* ── Ícone "C" inline — viewBox recortado no conteúdo real do Illustrator ── */
// canvas original: 1080×1080 · conteúdo visual: x 377–703, y 362–719
// viewBox: conteúdo real x 375–706, y 362–720  →  331 × 358 px
// Renderizado com height fixo; width calculado pela proporção para não distorcer
function LogoIcon({ height = 44, dark = false }: { height?: number; dark?: boolean }) {
  const W = 331, H = 358          // dimensões reais do conteúdo
  const width = (height * W) / H  // mantém proporção sem distorção
  const ringColor = dark ? '#FFFFFF' : '#0F1B2D'
  return (
    <svg
      viewBox="375 362 331 358"
      role="img"
      aria-label=""
      aria-hidden="true"
      style={{ width, height, flexShrink: 0, display: 'block' }}
    >
      {/* arcos verdes (fan) */}
      <path opacity="0.97" fill="#00B884" d="M553.7,508.2v35.2h36.3C586.6,525.2,572.1,511,553.7,508.2z"/>
      <path opacity="0.97" fill="#00B884" d="M702.3,444.6l-17.9,11.9c-28.8-42.3-76.3-70.8-130.7-73.4v-21.5C615.5,364.2,669.6,396.5,702.3,444.6z"/>
      <path opacity="0.97" fill="#00B884" d="M661.4,471.8l-17.8,11.9c-19.9-29.2-52.5-49-89.9-51.6v-21.4C598.5,413.3,637.6,436.9,661.4,471.8z"/>
      <path opacity="0.97" fill="#00B884" d="M620.8,499l-18.6,12.4c-11-15.8-28.4-26.8-48.5-29.2v-22.5C581.6,462.2,605.8,477.1,620.8,499z"/>
      {/* arco principal (anel) */}
      <path opacity="0.97" fill={ringColor} d="M537.2,383.1v49.1c-59.4,4-106.8,51.7-110.4,111.2h-49C381.5,456.8,450.8,387.2,537.2,383.1z"/>
      <path opacity="0.97" fill={ringColor} d="M377.8,559.5h49.1c4.2,58.9,51.4,105.9,110.4,109.9v49.1C451.2,714.3,382.2,645.4,377.8,559.5z"/>
      <path opacity="0.97" fill={ringColor} d="M684.4,645c-28.7,42.3-76.3,70.8-130.7,73.4v-49c36.7-2.5,68.9-21.7,88.9-50.1L684.4,645z"/>
      <path opacity="0.97" fill={ringColor} d="M537.2,669.4v49.1c-86-4.1-155-73-159.5-159h49.1C431.1,618.3,478.2,665.3,537.2,669.4z"/>
    </svg>
  )
}

/* ── Ícones ───────────────────────────────────────────────────────────────── */

function IconSun() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
         style={{ width: 16, height: 16, flexShrink: 0 }}>
      <circle cx="10" cy="10" r="4" />
      <line x1="10" y1="1"  x2="10" y2="3"  />
      <line x1="10" y1="17" x2="10" y2="19" />
      <line x1="1"  y1="10" x2="3"  y2="10" />
      <line x1="17" y1="10" x2="19" y2="10" />
      <line x1="3.5"  y1="3.5"  x2="5"    y2="5"    />
      <line x1="15"   y1="15"   x2="16.5" y2="16.5" />
      <line x1="3.5"  y1="16.5" x2="5"    y2="15"   />
      <line x1="15"   y1="5"    x2="16.5" y2="3.5"  />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor"
         style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  )
}


/* ── Mapa do Brasil SVG ───────────────────────────────────────────────────── */
//
// Path simplificado (Visvalingam-Whyatt ~95%) derivado do contorno do Brasil
// em coordenadas normalizadas para um viewBox 0 0 500 540.
// Regiões usadas para posicionar os bubbles de municípios (cx/cy em px do viewBox):
//   Norte       ~200,130
//   Nordeste    ~340,185
//   Centro-Oeste~235,295
//   Sudeste     ~315,370
//   Sul         ~270,445
//
const BRAZIL_PATH =
  // Contorno exterior — simplificado mas reconhecível
  'M 148,38 ' +
  'C 158,32 178,30 192,36 210,30 228,28 248,30 265,36 ' +
  'L 285,32 310,36 330,32 358,38 ' +
  'C 375,34 388,46 395,60 L 400,80 ' +
  'C 404,96 408,112 412,128 L 410,145 ' +
  'C 406,162 398,175 390,185 L 378,195 ' +
  'C 368,205 360,218 355,230 L 352,245 ' +
  'C 350,258 352,270 358,280 L 364,292 ' +
  'C 368,302 368,314 362,323 L 354,330 ' +
  'C 345,338 332,342 320,345 L 305,348 ' +
  'C 292,350 280,354 272,362 L 268,375 ' +
  'C 265,385 268,396 275,404 L 285,412 ' +
  'C 295,420 304,430 308,442 L 308,455 ' +
  'C 306,466 298,474 288,478 L 275,480 ' +
  'C 262,482 250,480 240,475 L 228,468 ' +
  'C 218,462 208,460 198,462 L 188,466 ' +
  'C 178,470 170,476 162,480 L 150,484 ' +
  'C 138,487 126,485 116,480 L 105,473 ' +
  'C 95,466 87,456 82,445 L 78,432 ' +
  'C 74,420 72,408 68,397 L 62,385 ' +
  'C 56,373 46,364 36,358 L 25,352 ' +
  'C 15,346 8,336 6,325 L 5,312 ' +
  'C 4,300 7,288 12,278 L 20,268 ' +
  'C 28,258 38,250 46,240 L 52,228 ' +
  'C 56,218 56,207 52,197 L 46,187 ' +
  'C 40,177 32,168 28,157 L 26,145 ' +
  'C 24,133 26,120 32,110 L 40,100 ' +
  'C 50,88 64,80 78,74 L 94,68 ' +
  'C 108,62 122,58 134,50 L 142,38 ' +
  'Z'

interface BubbleData {
  cx: number; cy: number; r: number
  color: string; label?: string
  region: string
  quadrant: string
  detail: string
}

const BUBBLES: BubbleData[] = [
  // Norte
  { cx: 155, cy: 108, r: 9,  color: 'var(--q4)',  region: 'Norte · Amazonas',    quadrant: 'Q4 · Monitorar',              detail: 'Baixo potencial atual. Reavaliação em 12 meses.' },
  { cx: 200, cy:  85, r: 7,  color: 'var(--q2b)', region: 'Norte · Pará',         quadrant: 'Q2b · Satélite / grant',       detail: 'Elegível ao FUST. Viável via LEO com grant.' },
  { cx: 240, cy:  72, r: 6,  color: 'var(--q4)',  region: 'Norte · Roraima',      quadrant: 'Q4 · Monitorar',              detail: 'Densidade muito baixa. Monitoramento semestral.' },
  { cx: 125, cy: 155, r: 8,  color: 'var(--q2b)', region: 'Norte · Acre',         quadrant: 'Q2b · Satélite / grant',       detail: 'Área isolada. Satélite LEO é a única viabilidade.' },
  { cx: 175, cy: 148, r: 7,  color: 'var(--q4)',  region: 'Norte · Rondônia',     quadrant: 'Q4 · Monitorar',              detail: 'Score abaixo do limiar. Revisar em 2026.' },
  // Nordeste
  { cx: 345, cy: 178, r: 20, color: 'var(--q2a)', region: 'Nordeste · Ceará',     quadrant: 'Q2a · Expandir c/ alavancas', detail: '12 municípios. Alavancas FUST + ENEC reduzem CapEx em 35%.', label: '12' },
  { cx: 310, cy: 148, r: 10, color: 'var(--q2b)', region: 'Nordeste · Maranhão',  quadrant: 'Q2b · Satélite / grant',       detail: 'Alta dispersão. FWA 5G ou satélite recomendado.' },
  { cx: 370, cy: 210, r: 8,  color: 'var(--q2a)', region: 'Nordeste · Bahia N',   quadrant: 'Q2a · Expandir c/ alavancas', detail: 'Acordo estadual Anatel disponível.' },
  { cx: 340, cy: 240, r: 11, color: 'var(--q1)',  region: 'Nordeste · Bahia S',   quadrant: 'Q1 · Expandir já',            detail: '7 municípios. Backhaul a 55 km da rede ativa.', label: '7' },
  { cx: 385, cy: 170, r: 7,  color: 'var(--q4)',  region: 'Nordeste · Sergipe',   quadrant: 'Q4 · Monitorar',              detail: 'Mercado pequeno. ROI insuficiente no horizonte atual.' },
  // Centro-Oeste
  { cx: 215, cy: 285, r: 10, color: 'var(--q3)',  region: 'Centro-Oeste · MT',    quadrant: 'Q3 · Comercial / M&A',        detail: 'Concorrente estabelecido. Avaliar aquisição.' },
  { cx: 258, cy: 258, r: 8,  color: 'var(--q4)',  region: 'Centro-Oeste · GO',    quadrant: 'Q4 · Monitorar',              detail: 'Score composto abaixo do limiar mínimo.' },
  { cx: 245, cy: 310, r: 9,  color: 'var(--q2a)', region: 'Centro-Oeste · MS',    quadrant: 'Q2a · Expandir c/ alavancas', detail: 'Incentivo estadual confirmado. CapEx -28%.' },
  { cx: 195, cy: 240, r: 7,  color: 'var(--q3)',  region: 'Centro-Oeste · DF',    quadrant: 'Q3 · Comercial / M&A',        detail: 'Alta competição. Avaliar parceria com ISP local.' },
  // Norte / NE (cluster maior)
  { cx: 100, cy: 220, r: 18, color: 'var(--q1)',  region: 'Norte-NE · Tocantins', quadrant: 'Q1 · Expandir já',            detail: '24 municípios. Payback médio 3,2 anos. Alta densidade escolar.', label: '24' },
  { cx:  70, cy: 185, r: 7,  color: 'var(--q2b)', region: 'Norte · Pará W',       quadrant: 'Q2b · Satélite / grant',       detail: 'Área de proteção ambiental. Satélite obrigatório.' },
  // Sudeste
  { cx: 318, cy: 355, r: 22, color: 'var(--q1)',  region: 'Sudeste · SP/MG',      quadrant: 'Q1 · Expandir já',            detail: '18 municípios. Melhor ROI da carteira. Backhaul a < 40 km.', label: '18' },
  { cx: 355, cy: 330, r: 11, color: 'var(--q2a)', region: 'Sudeste · RJ',         quadrant: 'Q2a · Expandir c/ alavancas', detail: 'Acordo TCU elegível. CapEx subsidiado disponível.' },
  { cx: 290, cy: 340, r: 8,  color: 'var(--q1)',  region: 'Sudeste · MG',         quadrant: 'Q1 · Expandir já',            detail: '5 municípios. Região mineradora com alta renda.', label: '5' },
  { cx: 370, cy: 365, r: 7,  color: 'var(--q4)',  region: 'Sudeste · ES',         quadrant: 'Q4 · Monitorar',              detail: 'Aguardar resultado do leilão de frequências.' },
  // Sul
  { cx: 272, cy: 432, r: 16, color: 'var(--q1)',  region: 'Sul · PR/SC',          quadrant: 'Q1 · Expandir já',            detail: '9 municípios. Backhaul próprio disponível.', label: '9' },
  { cx: 240, cy: 405, r: 9,  color: 'var(--q2b)', region: 'Sul · SC serrana',     quadrant: 'Q2b · Satélite / grant',       detail: 'Território isolado. Satélite LEO avaliado.' },
  { cx: 302, cy: 455, r: 8,  color: 'var(--q2a)', region: 'Sul · RS',             quadrant: 'Q2a · Expandir c/ alavancas', detail: '3 municípios. ENEC viabiliza expansão em 2025.', label: '3' },
  { cx: 258, cy: 460, r: 6,  color: 'var(--q4)',  region: 'Sul · RS fronteira',   quadrant: 'Q4 · Monitorar',              detail: 'Região de fronteira. Aguardar regulação Anatel.' },
]

function BrazilMap() {
  const [hovered, setHovered]       = React.useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 })
  const svgRef = React.useRef<SVGSVGElement>(null)

  const handleMouseEnter = (i: number, e: React.MouseEvent<SVGCircleElement>) => {
    setHovered(i)
    updatePos(e)
  }
  const handleMouseMove  = (e: React.MouseEvent<SVGCircleElement>) => updatePos(e)
  const handleMouseLeave = () => setHovered(null)

  const updatePos = (e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const hov = hovered !== null ? BUBBLES[hovered] : null

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 600 }}>
      <svg
        ref={svgRef}
        viewBox="0 0 420 516"
        role="img"
        aria-label="Mapa do Brasil com municípios por quadrante de prioridade"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <clipPath id="map-clip">
            <rect x="0" y="0" width="420" height="516" />
          </clipPath>
        </defs>

        <g clipPath="url(#map-clip)">
          <path d={BRAZIL_PATH} fill="var(--so)" />

          {/* Linhas de backhaul — apenas dentro do contorno */}
          <line x1="100" y1="220" x2="345" y2="178" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="345" y1="178" x2="318" y2="355" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="318" y1="355" x2="272" y2="432" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="215" y1="285" x2="318" y2="355" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="345" y1="178" x2="340" y2="240" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="340" y1="240" x2="318" y2="355" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="258" y1="258" x2="215" y2="285" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="272" y1="432" x2="302" y2="455" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />
          <line x1="310" y1="148" x2="345" y2="178" stroke="var(--ln)" strokeWidth="1" opacity=".5" strokeDasharray="4 5" />

          {BUBBLES.map((b, i) => {
            const isHov = hovered === i
            return (
              <g key={i} style={{ cursor: 'pointer' }}>
                {isHov && (
                  <circle cx={b.cx} cy={b.cy} r={b.r + 6}
                    fill="none" stroke={b.color} strokeWidth="1.5" opacity="0.4" />
                )}
                <circle
                  cx={b.cx} cy={b.cy} r={b.r}
                  fill={b.color} opacity={isHov ? 1 : 0.88}
                  style={{ transition: 'opacity .15s' }}
                  onMouseEnter={(e) => handleMouseEnter(i, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
                {b.label && (
                  <text x={b.cx} y={b.cy} fill="#fff"
                    fontSize={b.r < 16 ? 9 : 12} fontWeight="600"
                    textAnchor="middle" dominantBaseline="central"
                    style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'inherit' }}>
                    {b.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {hov && (
        <div style={{
          position: 'absolute',
          left: tooltipPos.x + 14,
          top:  tooltipPos.y - 12,
          pointerEvents: 'none',
          background: 'var(--pn)',
          border: '1px solid var(--ln)',
          borderRadius: 8,
          padding: '10px 14px',
          minWidth: 210, maxWidth: 260,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: hov.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>{hov.region}</span>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mu)', marginBottom: 5 }}>{hov.quadrant}</div>
          <div style={{ fontSize: 12, color: 'var(--tx)', lineHeight: 1.5 }}>{hov.detail}</div>
        </div>
      )}
    </div>
  )
}

/* ── HomeView ─────────────────────────────────────────────────────────────── */

export default function HomeView({ onEnter }: HomeViewProps) {
  const theme    = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const isDark = theme === 'dark'

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  /* ── Estilos base ───────────────────────────────────────────────────────── */
  const wrap: React.CSSProperties = {
    maxWidth: 1180,
    margin: '0 auto',
    paddingLeft: 48,
    paddingRight: 48,
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    font: 'inherit',
    textDecoration: 'none',
    transition: 'background .15s, color .15s, border-color .15s',
  }

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: 'var(--ac)',
    color: 'var(--on)',
  }

  const btnGhost: React.CSSProperties = {
    ...btnBase,
    borderColor: 'var(--ln)',
    color: 'var(--tx)',
    background: 'var(--pn)',
  }

  // Botão de tema — ícone quadrado compacto
  const btnTheme: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 6,
    border: '1px solid var(--ln)',
    background: 'var(--pn)',
    color: 'var(--tx)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background .15s, border-color .15s',
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--land)',
        color: 'var(--tx)',
        fontFamily: '"IBM Plex Sans", system-ui, "Segoe UI", Arial, sans-serif',
      }}
    >
      <div style={wrap}>

        {/* ── Topbar ───────────────────────────────────────────────────────── */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* ícone quadrado 44×44, centrado verticalmente pelo flex pai */}
            <LogoIcon height={44} dark={isDark} />
            {/* bloco de texto: "conecta+" em cima, tagline embaixo */}
            <div>
              <img
                src={isDark ? logoTextoBranca : logoTexto}
                alt="Conecta+"
                style={{ display: 'block', height: 19, width: 'auto', marginBottom: 4 }}
              />
              <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1, color: 'var(--mu)' }}>
                Expansão de conectividade
              </span>
            </div>
          </div>

          {/* Toggle de tema */}
          <button
            onClick={toggleTheme}
            style={btnTheme}
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {isDark ? <IconSun /> : <IconMoon />}
          </button>
        </header>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          style={{
            display: 'flex',
            gap: 56,
            alignItems: 'center',
            flexWrap: 'wrap',
            paddingTop: 28,
            paddingBottom: 64,
          }}
        >
          {/* Texto CTA — animação heroIn definida no index.css */}
          <div style={{ flex: '1 1 420px' }} className="hv-hero-text">
            <h1
              style={{
                fontSize: 42,
                lineHeight: 1.15,
                fontWeight: 700,
                margin: '0 0 18px',
                maxWidth: '20ch',
                color: 'var(--tx)',
              }}
            >
              Decida onde expandir{' '}
              <span style={{ color: 'var(--ac)' }}>com agentes que raciocinam pelos dados.</span>
            </h1>
            <p style={{ fontSize: 15.5, color: 'var(--mu)', maxWidth: '48ch', lineHeight: 1.65, marginBottom: 32 }}>
              Cinco agentes especializados analisam mercado, impacto educacional, custo e
              alavancas públicas e entregam o portfólio ótimo de expansão com justificativa
              auditável em linguagem natural, gerada pelo IBM Granite.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={onEnter} style={btnPrimary}>
                Abrir o painel
              </button>
              <a
                href="https://github.com/RafaelSdeS/conecta-mais/blob/main/docs/DOCUMENTACAO.md"
                target="_blank"
                rel="noopener noreferrer"
                style={btnGhost}
              >
                Ver documentação
              </a>
            </div>
          </div>

          {/* Mapa do Brasil interativo */}
          <div style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', marginTop: -48 }}>
            <BrazilMap />
          </div>
        </section>

        {/* ── Stat strip ───────────────────────────────────────────────────── */}
        <section
          aria-label="Dados do problema"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingBottom: 64 }}
        >
          {STATS.map((s) => (
            <div
              key={s.value}
              style={{
                flex: '1 1 230px',
                background: 'var(--pn)',
                border: '1px solid var(--ln)',
                borderRadius: 8,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 27, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--mu)', marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section style={{ paddingBottom: 60 }} aria-label="O que o Conecta+ faz">
          <h2 style={{ fontSize: 22, margin: '0 0 6px', color: 'var(--tx)' }}>
            O que o Conecta+ faz
          </h2>
          <p style={{ color: 'var(--mu)', fontSize: 14, marginBottom: 26, maxWidth: '60ch' }}>
            Um cenário único — orçamento, objetivo e alavancas — alimenta todas as telas abaixo.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  flex: '1 1 230px',
                  background: 'var(--pn)',
                  border: '1px solid var(--ln)',
                  borderRadius: 8,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: f.color,
                    marginBottom: 14,
                  }}
                />
                <h3 style={{ fontSize: 15, margin: '0 0 8px', fontWeight: 600, color: 'var(--tx)' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13.5, color: 'var(--mu)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Quadrantes ───────────────────────────────────────────────────── */}
        <section style={{ paddingBottom: 64 }} aria-label="Classificação de municípios">
          <h2 style={{ fontSize: 17, margin: '0 0 6px', color: 'var(--tx)' }}>
            Como cada município é classificado
          </h2>
          <p style={{ color: 'var(--mu)', fontSize: 13.5, marginBottom: 18 }}>
            Score Duplo 2.0: mercado (M), impacto educacional (I), custo (C) e alavancas (A).
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {QUADRANTS.map((q) => (
              <span
                key={q.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--pn)',
                  border: '1px solid var(--ln)',
                  borderRadius: 999,
                  padding: '9px 16px',
                  fontSize: 13,
                  color: 'var(--tx)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: q.color,
                    flexShrink: 0,
                  }}
                />
                {q.label}
              </span>
            ))}
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: '1px solid var(--ln)',
            padding: '26px 0 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mu)', fontSize: 13 }}>
            <LogoIcon height={18} dark={isDark} />
            <img
              src={isDark ? logoTextoBranca : logoTexto}
              alt="Conecta+"
              style={{ display: 'block', height: 14, width: 'auto', opacity: 0.7 }}
            />
          </div>
          <div style={{ fontSize: 13, color: 'var(--mu)', textAlign: 'right' }}>
            Desafio IBM SkillsBuild &amp; Fundação Telefônica Vivo · novembro de 2026 · Rafael, Joel e Chris
            <br />
            <a
              href="https://github.com/RafaelSdeS/conecta-mais"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--mu)', borderBottom: '1px solid var(--ln)', textDecoration: 'none' }}
            >
              Repositório no GitHub
            </a>
          </div>
        </footer>

      </div>
    </div>
  )
}

/* ── Dados estáticos ──────────────────────────────────────────────────────── */

const STATS = [
  { value: '5.565', label: 'municípios avaliados com dados reais do IBGE, INEP e Anatel' },
  { value: '46.357', label: 'escolas públicas sem internet para aprendizagem (34%)' },
  { value: '8,5 mi', label: 'alunos matriculados nessas escolas' },
  { value: '453', label: 'cidades hoje com fibra da Vivo (cerca de 8%)' },
]

const FEATURES = [
  {
    title: 'Painel',
    color: 'var(--q1)',
    desc: 'Mapa do Brasil, quadrantes de prioridade e o portfólio ótimo para o orçamento que você definir.',
  },
  {
    title: 'Municípios',
    color: 'var(--q2a)',
    desc: 'Tabela com os 5.565 municípios, filtros por UF, quadrante e decisão, e a ficha de qualquer um a um clique.',
  },
  {
    title: 'Agente',
    color: 'var(--ac)',
    desc: 'Pergunte em português. O IBM Granite responde com os números calculados pelo motor — nunca inventa um valor.',
  },
  {
    title: 'Solução',
    color: 'var(--q4)',
    desc: 'Arquitetura completa, ROI estimado e o estado real de cada entrega, sem esconder o que ainda falta.',
  },
]

const QUADRANTS = [
  { label: 'Q1 · Expandir já',              color: 'var(--q1)'  },
  { label: 'Q2a · Expandir com alavancas',   color: 'var(--q2a)' },
  { label: 'Q2b · Satélite / grant',          color: 'var(--q2b)' },
  { label: 'Q3 · Comercial / M&A',            color: 'var(--q3)'  },
  { label: 'Q4 · Monitorar',                  color: 'var(--q4)'  },
]
