/**
 * MapContainer — Leaflet + OpenStreetMap (sem chave de API).
 *
 * Responde ao cenário: recebe os municípios já filtrados (mesmo filtro da tabela), colore por
 * quadrante/payback/score/alunos, enquadra o recorte ao filtrar, voa até o município aberto na
 * ficha, destaca o município sob o mouse na tabela e mostra camadas reais (backhaul de fibra e
 * alunos em escolas sem internet). Marcadores em canvas para suportar os 5.565 municípios.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useAppStore, type ColorBy } from '../store/appStore'
import { DECISOES, QUADRANT_HEX, QUADRANT_NAMES } from '../utils/constants'
import { fmtAnos, fmtMi, fmtN0 } from '../utils/format'
import RegionChips from './RegionChips'
import type { Decisao, FinanceiroLinha, Municipio } from '../api/client'

const BRASIL: [number, number] = [-14.2, -51.9]

const COLOR_MODES: { value: ColorBy; label: string }[] = [
  { value: 'quadrante', label: 'Quadrante' },
  { value: 'payback',   label: 'Payback' },
  { value: 'score',     label: 'Score total' },
  { value: 'alunos',    label: 'Alunos sem internet' },
  { value: 'decisao',   label: 'Decisão' },
]

// Leaflet precisa de cor literal (não aceita var(--x)); mesmas cores de DECISOES.
const DECISAO_HEX: Record<string, string> = {
  Aprovado: '#138a5b', Adiado: '#d9822b', Descartado: '#6b7280', Pendente: '#c9ced6',
}

/** Rampa verde (bom) → vermelho (ruim); t em [0,1], 0 = melhor. */
const rampa = (t: number) => `hsl(${Math.round(140 * (1 - Math.min(1, Math.max(0, t))))}, 70%, 45%)`
const GRADIENTE = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(rampa).join(',')})`

interface Escala {
  cor: (m: Municipio) => string
  min: string
  max: string
  titulo: string
  /** Legenda categórica (quadrante, decisão) no lugar do gradiente. */
  categorias?: [string, string][]
}

function criaEscala(
  colorBy: ColorBy, municipios: Municipio[], fin: Record<string, FinanceiroLinha>, decisoes: Record<string, Decisao>,
): Escala {
  if (colorBy === 'decisao') {
    return {
      titulo: 'Decisão', min: '', max: '', categorias: Object.entries(DECISAO_HEX),
      cor: (m) => DECISAO_HEX[decisoes[m.id_municipio] ? DECISOES[decisoes[m.id_municipio].decisao].label : 'Pendente'],
    }
  }
  if (colorBy === 'payback') {
    return {
      titulo: 'Payback (anos)', min: '≤ 5,7 (melhor)', max: '≥ 12 (pior)',
      cor: (m) => {
        const p = fin[m.id_municipio]?.payback
        return p == null ? '#8a94a3' : rampa((p - 5.7) / (12 - 5.7))
      },
    }
  }
  if (colorBy === 'score') {
    const v = municipios.map((m) => m.score_total ?? 0)
    const lo = Math.min(...v), hi = Math.max(...v)
    return {
      titulo: 'Score total', min: `${lo.toFixed(0)} (baixo)`, max: `${hi.toFixed(0)} (alto)`,
      cor: (m) => rampa(1 - ((m.score_total ?? 0) - lo) / ((hi - lo) || 1)),
    }
  }
  if (colorBy === 'alunos') {
    const hi = Math.log10(Math.max(10, ...municipios.map((m) => m.alunos_sem_internet ?? 0)))
    return {
      titulo: 'Alunos em escolas sem internet (escala log)', min: 'poucos', max: `${fmtN0(10 ** hi)}`,
      cor: (m) => rampa(1 - Math.log10(Math.max(1, m.alunos_sem_internet ?? 0)) / hi),
    }
  }
  return {
    titulo: 'Quadrante', min: '', max: '', categorias: Object.entries(QUADRANT_HEX),
    cor: (m) => QUADRANT_HEX[m.quadrante] ?? '#8a94a3',
  }
}

interface Props {
  municipios: Municipio[]
  portfolioIds: Set<string>
  onMunicipioClick: (id: string) => void
}

export default function MapContainer({ municipios, portfolioIds, onMunicipioClick }: Props) {
  const layers     = useAppStore((s) => s.layers)
  const setLayers  = useAppStore((s) => s.setLayers)
  const colorBy    = useAppStore((s) => s.colorBy)
  const setColorBy = useAppStore((s) => s.setColorBy)
  const filters    = useAppStore((s) => s.filters)
  const financeiro = useAppStore((s) => s.financeiro)
  const decisoes   = useAppStore((s) => s.decisoes)
  const selectedId = useAppStore((s) => s.selectedId)
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  const hoveredId  = useAppStore((s) => s.hoveredId)
  const totalCarregado = useAppStore((s) => s.municipios.length > 0)

  const mapElRef      = useRef<HTMLDivElement | null>(null)
  const mapRef        = useRef<L.Map | null>(null)
  const clusterRef    = useRef<L.MarkerClusterGroup | null>(null)
  const overlayRef    = useRef<L.LayerGroup | null>(null)
  const destaqueRef   = useRef<L.LayerGroup | null>(null)
  const porIdRef      = useRef<Map<string, Municipio>>(new Map())
  const onClickRef    = useRef(onMunicipioClick)
  useEffect(() => { onClickRef.current = onMunicipioClick }, [onMunicipioClick])

  const cssVar = useCallback((n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), [])
  const escala = useMemo(
    () => criaEscala(colorBy, municipios, financeiro, decisoes),
    [colorBy, municipios, financeiro, decisoes],
  )

  // ── Inicializa o mapa uma única vez ────────────────────────────────────────
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return
    const map = L.map(mapElRef.current, { center: BRASIL, zoom: 4, preferCanvas: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    overlayRef.current = L.layerGroup().addTo(map)
    destaqueRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
    }
  }, [])

  // ── Marcadores (só reconstruídos quando recorte, cor ou cenário mudam) ─────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (clusterRef.current) map.removeLayer(clusterRef.current)

    const acento = cssVar('--ac') || '#5b2a86'
    const contorno = cssVar('--tx') || '#1c2430'
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      disableClusteringAtZoom: 10,
      chunkedLoading: true,
      iconCreateFunction: (c: L.MarkerCluster) => {
        const n = c.getChildCount()
        const size = 24 + Math.min(20, Math.sqrt(n) * 2.5)
        return L.divIcon({
          className: '',
          iconSize: [size, size],
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${acento};opacity:.85;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600;border:2px solid #fff;">${n}</div>`,
        })
      },
    })

    const porId = new Map<string, Municipio>()
    const marcadores: L.Layer[] = []
    municipios.forEach((m) => {
      if (!m.lat || !m.lon) return
      porId.set(m.id_municipio, m)
      const noPortfolio = layers.selected && portfolioIds.has(m.id_municipio)
      const mk = L.circleMarker([m.lat, m.lon], {
        radius: 4 + Math.min(6, Math.sqrt(m.domicilios_urbanos ?? 0) / 60),
        fillColor: escala.cor(m),
        fillOpacity: 0.9,
        color: noPortfolio ? contorno : '#fff',
        weight: noPortfolio ? 2.5 : 0.8,
      })
      // Tooltip montado só ao passar o mouse; textContent evita injetar HTML do dado.
      mk.bindTooltip(() => {
        const f = financeiro[m.id_municipio]
        const el = document.createElement('div')
        const nome = document.createElement('b')
        nome.textContent = `${m.nome} (${m.uf})`
        el.append(nome)
        ;[
          `${m.quadrante} · ${QUADRANT_NAMES[m.quadrante] ?? ''}`,
          `Score ${m.score_total?.toFixed(0) ?? '—'} · M ${m.score_M?.toFixed(0) ?? '—'} · I ${m.score_I?.toFixed(0) ?? '—'}`,
          f ? `Payback ${fmtAnos(f.payback)} · CapEx ${fmtMi(f.capex)}` : '',
          f ? `VPL ${fmtMi(f.npv)}` : '',
          `Alunos sem internet: ${fmtN0(m.alunos_sem_internet)}`,
          noPortfolio ? 'No portfólio' : '',
        ].filter(Boolean).forEach((t) => {
          const linha = document.createElement('div')
          linha.textContent = t
          el.append(linha)
        })
        return el
      }, { sticky: true, direction: 'top', opacity: 0.95 })
      mk.on('click', () => onClickRef.current(m.id_municipio))
      marcadores.push(mk)
    })
    cluster.addLayers(marcadores)
    cluster.addTo(map)
    clusterRef.current = cluster
    porIdRef.current = porId
  }, [municipios, escala, financeiro, portfolioIds, layers.selected, cssVar])

  // ── Camadas de contexto: backhaul real e alunos sem internet ───────────────
  useEffect(() => {
    const grupo = overlayRef.current
    if (!grupo) return
    grupo.clearLayers()
    const acento = cssVar('--ac') || '#5b2a86'
    municipios.forEach((m) => {
      if (!m.lat || !m.lon) return
      if (layers.backhaul && m.tem_backhaul_fibra) {
        grupo.addLayer(L.circleMarker([m.lat, m.lon], {
          radius: 3, color: acento, weight: 1.5, fillColor: '#fff', fillOpacity: 1, interactive: false,
        }))
      }
      if (layers.schools && (m.alunos_sem_internet ?? 0) > 0) {
        grupo.addLayer(L.circleMarker([m.lat, m.lon], {
          radius: 6 + Math.min(18, Math.sqrt(m.alunos_sem_internet) / 25),
          color: QUADRANT_HEX['Q2b'], weight: 1, fillColor: QUADRANT_HEX['Q2b'], fillOpacity: 0.18, interactive: false,
        }))
      }
    })
  }, [municipios, layers.backhaul, layers.schools, cssVar])

  // ── Enquadra o recorte ao filtrar ──────────────────────────────────────────
  const filtrosKey = JSON.stringify(filters)
  useEffect(() => {
    const map = mapRef.current
    const pontos = municipios.filter((m) => m.lat && m.lon)
    if (!map || !pontos.length) return
    if (pontos.length === 1) map.setView([pontos[0].lat, pontos[0].lon], 10)
    else map.fitBounds(L.latLngBounds(pontos.map((m) => [m.lat, m.lon] as [number, number])), { padding: [30, 30], maxZoom: 9 })
  // Só quando os filtros mudam (ou os dados chegam), não a cada recálculo do cenário.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosKey, totalCarregado])

  // ── Destaque: município aberto na ficha e município sob o mouse na tabela ──
  useEffect(() => {
    const map = mapRef.current
    const grupo = destaqueRef.current
    if (!map || !grupo) return
    grupo.clearLayers()
    const acento = cssVar('--ac') || '#5b2a86'
    const anel = (m: Municipio, raio: number, peso: number) =>
      L.circleMarker([m.lat, m.lon], { radius: raio, color: acento, weight: peso, fillOpacity: 0, interactive: false })
    const sel = drawerOpen && selectedId ? porIdRef.current.get(selectedId) : undefined
    if (sel) {
      grupo.addLayer(anel(sel, 16, 3))
      map.flyTo([sel.lat, sel.lon], Math.max(map.getZoom(), 9), { duration: 0.8 })
    }
    const hov = hoveredId ? porIdRef.current.get(hoveredId) : undefined
    if (hov && hov !== sel) grupo.addLayer(anel(hov, 13, 2))
  }, [selectedId, drawerOpen, hoveredId, municipios, cssVar])

  function enquadrar() {
    const map = mapRef.current
    const pontos = municipios.filter((m) => m.lat && m.lon)
    if (map && pontos.length) {
      map.fitBounds(L.latLngBounds(pontos.map((m) => [m.lat, m.lon] as [number, number])), { padding: [30, 30], maxZoom: 9 })
    }
  }

  const seletor: React.CSSProperties = {
    font: 'inherit', fontSize: 12, background: 'var(--pn)', color: 'var(--tx)',
    border: '1px solid var(--ln)', borderRadius: 4, padding: '3px 8px',
  }

  return (
    <div>
      {/* Controles */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13, color: 'var(--mu)', marginBottom: 10 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Colorir por
          <select value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)} style={seletor} aria-label="Colorir mapa por">
            {COLOR_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {([
          ['backhaul', 'Backhaul de fibra (Anatel)'],
          ['schools', 'Alunos sem internet'],
          ['selected', 'Destacar portfólio'],
        ] as const).map(([key, label]) => (
          <label key={key} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(e) => setLayers({ [key]: e.target.checked })}
              style={{ accentColor: 'var(--ac)' }}
            />
            {label}
          </label>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <div
          ref={mapElRef}
          style={{ width: '100%', height: 'clamp(320px, 62vh, 640px)', borderRadius: 4, background: 'var(--land)', zIndex: 0 }}
        />
        <RegionChips />
      </div>

      {/* Legenda + ações */}
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--mu)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b style={{ color: 'var(--tx)' }}>{escala.titulo}</b>
          {escala.categorias ? (
            escala.categorias.map(([q, hex]) => (
              <span key={q} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: hex, display: 'inline-block' }} />
                {q}
              </span>
            ))
          ) : (
            <>
              <span>{escala.min}</span>
              <span style={{ width: 120, height: 8, borderRadius: 4, background: GRADIENTE, display: 'inline-block' }} />
              <span>{escala.max}</span>
            </>
          )}
          <span>· {fmtN0(municipios.length)} municípios no mapa</span>
        </div>
        <button
          onClick={enquadrar}
          style={{ font: 'inherit', fontSize: 12, background: 'none', border: '1px solid var(--ln)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', color: 'var(--mu)' }}
        >
          ⤢ Enquadrar recorte
        </button>
      </div>
    </div>
  )
}
