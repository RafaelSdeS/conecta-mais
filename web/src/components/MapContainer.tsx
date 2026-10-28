/**
 * MapContainer — Leaflet + OpenStreetMap.
 * Sem chave de API, sem restrição de domínio.
 * Funcionalidades: marcadores por quadrante, clustering, layers
 * (backhaul, escolas, mobile, portfólio), tooltip hover, click → drawer.
 */

import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useAppStore } from '../store/appStore'
import { QUADRANT_HEX } from '../utils/constants'
import type { Municipio } from '../api/client'

// ── PoPs de backhaul simulados (mesmos do protótipo) ─────────────────────────
const POPS = [
  { lat: -12.97, lng: -38.51 }, { lat: -14.86, lng: -40.84 },
  { lat: -11.86, lng: -41.67 }, { lat: -10.94, lng: -37.07 },
  { lat: -15.60, lng: -39.04 }, { lat: -12.15, lng: -44.99 },
  { lat: -16.44, lng: -39.07 }, { lat: -13.41, lng: -39.07 },
  { lat: -11.41, lng: -41.86 }, { lat: -14.18, lng: -41.68 },
  { lat: -9.40,  lng: -40.50 }, { lat: -10.47, lng: -42.75 },
  { lat: -13.00, lng: -46.00 }, { lat: -15.24, lng: -44.00 },
]

const MAP_CENTER: [number, number] = [-13.0, -41.7]
const ESC_ZOOM = 8

// Helper: cria ícone SVG circular colorido
function circleIcon(color: string, size: number, strokeColor = '#fff', strokeWidth = 1): L.DivIcon {
  const r = size / 2
  const s = size + strokeWidth * 2
  return L.divIcon({
    className: '',
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="${color}" fill-opacity="0.95" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    </svg>`,
  })
}

// Helper: cria ícone quadrado para PoPs
function squareIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    html: `<svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="10" height="10" fill="${color}"/>
    </svg>`,
  })
}

interface Props {
  municipios: Municipio[]
  portfolioIds: Set<string>
  onMunicipioClick: (id: string) => void
}

export default function MapContainer({ municipios, portfolioIds, onMunicipioClick }: Props) {
  const layers    = useAppStore((s) => s.layers)
  const setLayers = useAppStore((s) => s.setLayers)
  const filters   = useAppStore((s) => s.filters)

  const mapElRef      = useRef<HTMLDivElement | null>(null)
  const mapRef        = useRef<L.Map | null>(null)
  const clusterRef    = useRef<L.MarkerClusterGroup | null>(null)
  const overlayLayersRef = useRef<L.Layer[]>([])
  const escLayerRef   = useRef<L.LayerGroup | null>(null)
  const tooltipRef    = useRef<HTMLDivElement | null>(null)

  const getCssVar = useCallback((name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  , [])

  // ── Inicializa o mapa uma única vez ────────────────────────────────────────
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return

    const map = L.map(mapElRef.current, {
      center: MAP_CENTER,
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      clusterRef.current = null
    }
  }, [])

  // ── Redesenha marcadores e layers quando dados/filtros mudam ──────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const acColor = getCssVar('--ac') || '#5b2a86'

    // Remove overlays anteriores
    overlayLayersRef.current.forEach((l) => map.removeLayer(l))
    overlayLayersRef.current = []
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
      clusterRef.current = null
    }
    if (escLayerRef.current) {
      map.removeLayer(escLayerRef.current)
      escLayerRef.current = null
    }

    // ── Layer: densidade móvel (círculos vermelhos) ─────────────────────────
    if (layers.mobile) {
      municipios.forEach((m) => {
        if (!m.lat || !m.lon) return
        const circle = L.circle([m.lat, m.lon], {
          radius: 15000,
          color: 'transparent',
          fillColor: '#c0392b',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map)
        overlayLayersRef.current.push(circle)
      })
    }

    // ── Layer: backhaul PoPs (linhas + quadrados) ───────────────────────────
    if (layers.backhaul) {
      POPS.forEach((p, i) => {
        POPS.forEach((q, j) => {
          if (j <= i) return
          const dist = Math.hypot(p.lng - q.lng, p.lat - q.lat)
          if (dist < 3.2) {
            const line = L.polyline([[p.lat, p.lng], [q.lat, q.lng]], {
              color: acColor,
              opacity: 0.45,
              weight: 2,
              interactive: false,
            }).addTo(map)
            overlayLayersRef.current.push(line)
          }
        })
        const popMk = L.marker([p.lat, p.lng], {
          icon: squareIcon(acColor),
          interactive: false,
          title: 'PoP backhaul',
          zIndexOffset: 20,
        }).addTo(map)
        overlayLayersRef.current.push(popMk)
      })
    }

    // ── Marcadores de municípios + cluster ─────────────────────────────────
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      disableClusteringAtZoom: 10,
      iconCreateFunction: (c: L.MarkerCluster) => {
        const count = c.getChildCount()
        const size = 24 + Math.min(20, Math.sqrt(count) * 2.5)
        return L.divIcon({
          className: '',
          iconSize: [size, size],
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${acColor};opacity:0.85;
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-size:11px;font-weight:600;border:2px solid #fff;">
            ${count}
          </div>`,
        })
      },
    })

    // Escolas — layer group separado controlado pelo zoom
    const escLayer = L.layerGroup()

    municipios.forEach((m) => {
      if (!m.lat || !m.lon) return
      if (filters.search && !m.nome.toLowerCase().includes(filters.search.toLowerCase())) return
      if (filters.quadrante && m.quadrante !== filters.quadrante) return
      if (filters.portfolioOnly && !portfolioIds.has(m.id_municipio)) return

      const isSel  = layers.selected && portfolioIds.has(m.id_municipio)
      const color  = QUADRANT_HEX[m.quadrante] ?? '#8a94a3'
      const size   = 8 + Math.min(8, (m.domicilios_urbanos ?? 5000) / 25000)
      const stroke = isSel ? (getCssVar('--tx') || '#1c2430') : '#fff'
      const sw     = isSel ? 2.5 : 0.8

      const mk = L.marker([m.lat, m.lon], {
        icon: circleIcon(color, size, stroke, sw),
        zIndexOffset: 10,
        title: m.nome,
      })

      const tooltip = tooltipRef.current
      mk.on('mouseover', (e) => {
        if (!tooltip) return
        const ev = e.originalEvent as MouseEvent
        tooltip.style.display = 'block'
        tooltip.style.left = (ev.clientX + 12) + 'px'
        tooltip.style.top  = (ev.clientY + 12) + 'px'
        tooltip.innerHTML = `<b>${m.nome}</b><br>${m.quadrante} · M ${m.score_M?.toFixed(0) ?? '—'} · I ${m.score_I?.toFixed(0) ?? '—'}`
      })
      mk.on('mouseout', () => { if (tooltip) tooltip.style.display = 'none' })
      mk.on('click', () => {
        if (tooltip) tooltip.style.display = 'none'
        onMunicipioClick(m.id_municipio)
      })

      cluster.addLayer(mk)

      // Escolas com déficit ENEC
      if (layers.schools && (m.escolas_sem_internet_aprendizagem ?? 0) > 3) {
        const escMk = L.circleMarker([m.lat, m.lon], {
          radius: 5,
          color: QUADRANT_HEX['Q2b'] ?? '#d9822b',
          fillColor: 'transparent',
          weight: 1.5,
          interactive: false,
        })
        escLayer.addLayer(escMk)
      }
    })

    cluster.addTo(map)
    clusterRef.current = cluster

    escLayerRef.current = escLayer
    // Escolas aparecem só a partir do zoom ESC_ZOOM
    if (map.getZoom() >= ESC_ZOOM && layers.schools) {
      escLayer.addTo(map)
    }

    map.on('zoomend', () => {
      if (!escLayerRef.current) return
      if (map.getZoom() >= ESC_ZOOM && layers.schools) {
        if (!map.hasLayer(escLayerRef.current)) escLayerRef.current.addTo(map)
      } else {
        if (map.hasLayer(escLayerRef.current)) map.removeLayer(escLayerRef.current)
      }
    })

  }, [municipios, portfolioIds, layers, filters, getCssVar, onMunicipioClick])

  // ── Enquadrar visíveis ─────────────────────────────────────────────────────
  function fitVisible() {
    const map = mapRef.current
    if (!map) return
    const visible = municipios.filter((m) => {
      if (!m.lat || !m.lon) return false
      if (filters.search && !m.nome.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.quadrante && m.quadrante !== filters.quadrante) return false
      return true
    })
    if (!visible.length) return
    if (visible.length === 1) {
      map.setView([visible[0].lat, visible[0].lon], 11)
      return
    }
    const bounds = L.latLngBounds(visible.map((m) => [m.lat, m.lon]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }

  const LAYER_LABELS: { key: keyof ReturnType<typeof useAppStore.getState>['layers']; label: string }[] = [
    { key: 'backhaul', label: 'Backhaul (PoPs)' },
    { key: 'schools',  label: 'Escolas déficit ENEC' },
    { key: 'mobile',   label: 'Densidade móvel Vivo' },
    { key: 'selected', label: 'Portfólio selecionado' },
  ]

  return (
    <div>
      {/* Tooltip fixo */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          background: 'var(--tx)',
          color: 'var(--pn)',
          padding: '6px 10px',
          borderRadius: 4,
          fontSize: 12,
          display: 'none',
          zIndex: 9999,
          maxWidth: 220,
        }}
      />

      {/* Layer toggles */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--mu)', marginBottom: 10 }}>
        {LAYER_LABELS.map(({ key, label }) => (
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

      {/* Mapa */}
      <div
        ref={mapElRef}
        style={{
          width: '100%',
          height: 'clamp(320px, 62vh, 640px)',
          borderRadius: 4,
          background: 'var(--land)',
          zIndex: 0,
        }}
      />

      {/* Botão enquadrar */}
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--mu)', margin: 0 }}>
          Clique em um município para abrir a ficha executiva.
        </p>
        <button
          onClick={fitVisible}
          style={{
            font: 'inherit',
            fontSize: 12,
            background: 'none',
            border: '1px solid var(--ln)',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            color: 'var(--mu)',
          }}
        >
          ⤢ Enquadrar visíveis
        </button>
      </div>
    </div>
  )
}
