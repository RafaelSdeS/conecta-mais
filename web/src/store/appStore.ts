/**
 * Store global da aplicação — Zustand.
 *
 * Contém todo o estado compartilhado entre Header, Painel, Municípios,
 * Drawer e Paleta de Comandos.
 */

import { create } from 'zustand'
import type { Municipio, PortfolioResult } from '../api/client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Levers {
  fust:  boolean
  tcu:   boolean
  enec:  boolean
}

export interface Layers {
  backhaul: boolean
  schools:  boolean
  mobile:   boolean
  selected: boolean
}

export interface Filters {
  search:         string
  quadrante:      string
  portfolioOnly:  boolean
  favoritesOnly:  boolean
}

export interface Sort {
  key: string
  dir: 1 | -1
}

export interface KPIs {
  paybackMedio:     number
  countPortfolio:   number
  alunosConectados: number
  capexUsado:       number
  municipiosViaveis: number
  migracoes:        number
  paybackQ2Baseline: number
}

export type Theme = 'light' | 'dark'

// ── Store ─────────────────────────────────────────────────────────────────────

interface AppState {
  // Inputs do cenário
  budget: number
  levers: Levers
  layers: Layers
  filters: Filters
  sort: Sort

  // Dados
  municipios: Municipio[]
  portfolio: Municipio[]
  kpis: KPIs | null

  // UI
  selectedId: string | null
  drawerOpen: boolean
  cmdPaletteOpen: boolean
  theme: Theme

  // Loading / error
  loading: boolean
  portfolioLoading: boolean
  error: string | null

  // Actions — cenário
  setBudget: (v: number) => void
  setLevers: (l: Partial<Levers>) => void
  setAllLevers: (on: boolean) => void
  setLayers: (l: Partial<Layers>) => void
  setFilters: (f: Partial<Filters>) => void
  setSort: (s: Partial<Sort>) => void

  // Actions — dados
  setMunicipios: (m: Municipio[]) => void
  setPortfolioResult: (r: PortfolioResult) => void

  // Actions — UI
  openDrawer: (id: string) => void
  closeDrawer: () => void
  setCmdPaletteOpen: (open: boolean) => void
  setTheme: (t: Theme) => void
  setLoading: (v: boolean) => void
  setPortfolioLoading: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Defaults
  budget: 30,
  levers: { fust: false, tcu: false, enec: false },
  layers: { backhaul: true, schools: false, mobile: false, selected: true },
  filters: { search: '', quadrante: '', portfolioOnly: false, favoritesOnly: false },
  sort: { key: 'pay', dir: 1 },

  municipios: [],
  portfolio: [],
  kpis: null,

  selectedId: null,
  drawerOpen: false,
  cmdPaletteOpen: false,
  theme: 'light',

  loading: false,
  portfolioLoading: false,
  error: null,

  // Cenário
  setBudget: (v) => set({ budget: v }),
  setLevers: (l) => set((s) => ({ levers: { ...s.levers, ...l } })),
  setAllLevers: (on) => set({ levers: { fust: on, tcu: on, enec: on } }),
  setLayers: (l) => set((s) => ({ layers: { ...s.layers, ...l } })),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  setSort: (so) => set((s) => ({ sort: { ...s.sort, ...so } })),

  // Dados
  setMunicipios: (m) => set({ municipios: m }),
  setPortfolioResult: (r) =>
    set({
      portfolio: r.municipios,
      kpis: {
        paybackMedio:      r.payback_medio,
        countPortfolio:    r.n_selecionados,
        alunosConectados:  r.municipios.reduce((s, m) => s + (m.matriculas_publicas ?? 0), 0),
        capexUsado:        r.capex_total,
        municipiosViaveis: r.n_candidatos,
        migracoes:         0, // calculado no backend futuramente
        paybackQ2Baseline: 0, // calculado no backend futuramente
      },
    }),

  // UI
  openDrawer: (id) => set({ selectedId: id, drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  setCmdPaletteOpen: (open) => set({ cmdPaletteOpen: open }),
  setTheme: (t) => set({ theme: t }),
  setLoading: (v) => set({ loading: v }),
  setPortfolioLoading: (v) => set({ portfolioLoading: v }),
  setError: (e) => set({ error: e }),
}))
