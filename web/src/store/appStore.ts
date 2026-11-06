/**
 * Store global da aplicação — Zustand.
 *
 * Contém todo o estado compartilhado entre Header, Painel, Municípios,
 * Drawer e Paleta de Comandos. O cenário (orçamento, escopo, objetivo, alavancas e
 * premissas) é calculado no backend; `financeiro` guarda o resultado por município.
 */

import { create } from 'zustand'
import type {
  Achado,
  CampoQualidade,
  Decisao,
  FinancialParams,
  FinanceiroLinha,
  FonteDados,
  Municipio,
  Objetivo,
  PortfolioResult,
} from '../api/client'
import { DEFAULT_PARAMS, type ViewId } from '../utils/constants'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Levers {
  fust:  boolean
  tcu:   boolean
  enec:  boolean
}

export type ColorBy = 'quadrante' | 'payback' | 'score' | 'alunos' | 'decisao'

export interface Layers {
  backhaul: boolean
  schools:  boolean
  selected: boolean
}

export interface Filters {
  search:         string
  uf:             string
  regiao:         string
  semiarido:      boolean
  quadrante:      string
  portfolioOnly:  boolean
  favoritesOnly:  boolean
  /** '' = todas; 'pendente' = sem decisão registrada. */
  decisao:        '' | 'aprovar' | 'adiar' | 'descartar' | 'pendente'
}

export interface Sort {
  key: string
  dir: 1 | -1
}

export interface KPIs {
  paybackMedio:      number
  countPortfolio:    number
  alunosConectados:  number
  escolasAtendidas:  number
  capexUsado:        number
  vplTotal:          number
  /** Payback/VPL do mesmo portfólio sem alavancas (para mostrar o efeito delas). */
  semAlavancas:      { paybackMedio: number; vplTotal: number } | null
}

export type Theme = 'light' | 'dark'

const FILTROS_VAZIOS: Filters = {
  search: '', uf: '', regiao: '', semiarido: false, quadrante: '', portfolioOnly: false, favoritesOnly: false,
  decisao: '',
}

// ── Store ─────────────────────────────────────────────────────────────────────

export interface AppState {
  // Inputs do cenário
  budget: number
  levers: Levers
  params: FinancialParams
  objetivo: Objetivo
  layers: Layers
  colorBy: ColorBy
  filters: Filters
  sort: Sort

  // Dados
  municipios: Municipio[]
  fonteDados: FonteDados | null
  /** true quando o frontend não alcançou a API e caiu nos dados de demonstração. */
  apiOffline: boolean
  qualidade: CampoQualidade[]
  portfolio: Municipio[]
  financeiro: Record<string, FinanceiroLinha>
  kpis: KPIs | null
  /** Justificativas da IA por `${id}|${chaveCenario}` (entram no PDF da ficha e na decisão). */
  justificativas: Record<string, string>
  /** Explicação do portfólio pela IA; `chave` identifica o portfólio e o cenário em que foi gerada. */
  narrativa: { chave: string; texto: string } | null
  /** Achados do cenário pela IA; `chave` identifica o cenário em que foram gerados. */
  achados: { chave: string; cartoes: Achado[] } | null
  /** Decisão vigente por município (a mais recente registrada no servidor). */
  decisoes: Record<string, Decisao>

  // UI
  view: ViewId
  selectedId: string | null
  hoveredId: string | null
  drawerOpen: boolean
  cmdPaletteOpen: boolean
  theme: Theme

  // Loading / error
  loading: boolean
  portfolioLoading: boolean
  error: string | null

  // Ações
  setBudget: (v: number) => void
  setLevers: (l: Partial<Levers>) => void
  setAllLevers: (on: boolean) => void
  setParams: (p: Partial<FinancialParams>) => void
  resetParams: () => void
  setObjetivo: (o: Objetivo) => void
  setLayers: (l: Partial<Layers>) => void
  setColorBy: (c: ColorBy) => void
  setFilters: (f: Partial<Filters>) => void
  clearFilters: () => void
  setSort: (s: Partial<Sort>) => void
  setMunicipios: (m: Municipio[]) => void
  setFonteDados: (f: FonteDados) => void
  setApiOffline: (v: boolean) => void
  setQualidade: (q: CampoQualidade[]) => void
  setPortfolioResult: (r: PortfolioResult) => void
  setJustificativa: (id: string, texto: string) => void
  setNarrativa: (n: { chave: string; texto: string }) => void
  setAchados: (a: { chave: string; cartoes: Achado[] }) => void
  setDecisoes: (lista: Decisao[]) => void
  addDecisao: (d: Decisao) => void
  setView: (v: ViewId) => void
  openDrawer: (id: string) => void
  closeDrawer: () => void
  setHovered: (id: string | null) => void
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
  params: DEFAULT_PARAMS,
  objetivo: 'equilibrado',
  layers: { backhaul: true, schools: false, selected: true },
  colorBy: 'quadrante',
  filters: FILTROS_VAZIOS,
  sort: { key: 'pay', dir: 1 },

  municipios: [],
  fonteDados: null,
  apiOffline: false,
  qualidade: [],
  portfolio: [],
  financeiro: {},
  kpis: null,
  justificativas: {},
  narrativa: null,
  achados: null,
  decisoes: {},

  view: 'painel',
  selectedId: null,
  hoveredId: null,
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
  setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  resetParams: () => set({ params: DEFAULT_PARAMS }),
  setObjetivo: (o) => set({ objetivo: o }),
  setLayers: (l) => set((s) => ({ layers: { ...s.layers, ...l } })),
  setColorBy: (c) => set({ colorBy: c }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  clearFilters: () => set({ filters: FILTROS_VAZIOS }),
  setSort: (so) => set((s) => ({ sort: { ...s.sort, ...so } })),

  // Dados
  setMunicipios: (m) => set({ municipios: m }),
  setFonteDados: (f) => set({ fonteDados: f }),
  setApiOffline: (v) => set({ apiOffline: v }),
  setQualidade: (q) => set({ qualidade: q }),
  setPortfolioResult: (r) =>
    set({
      portfolio: r.municipios,
      financeiro: Object.fromEntries(r.financeiro.map((f) => [f.id_municipio, f])),
      kpis: {
        paybackMedio:      r.payback_medio,
        countPortfolio:    r.n_selecionados,
        alunosConectados:  r.alunos_atendidos,
        escolasAtendidas:  r.escolas_atendidas,
        capexUsado:        r.capex_total,
        vplTotal:          r.vpl_total,
        semAlavancas: r.efeito_alavancas
          ? { paybackMedio: r.efeito_alavancas.sem.payback_medio, vplTotal: r.efeito_alavancas.sem.vpl_total }
          : null,
      },
    }),
  setJustificativa: (id, texto) => set((s) => ({ justificativas: { ...s.justificativas, [id]: texto } })),
  setNarrativa: (n) => set({ narrativa: n }),
  setAchados: (a) => set({ achados: a }),
  setDecisoes: (lista) => set({ decisoes: Object.fromEntries(lista.map((d) => [d.id_municipio, d])) }),
  addDecisao: (d) => set((s) => ({ decisoes: { ...s.decisoes, [d.id_municipio]: d } })),

  // UI
  setView: (v) => set({ view: v }),
  openDrawer: (id) => set({ selectedId: id, drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  setHovered: (id) => set({ hoveredId: id }),
  setCmdPaletteOpen: (open) => set({ cmdPaletteOpen: open }),
  setTheme: (t) => set({ theme: t }),
  setLoading: (v) => set({ loading: v }),
  setPortfolioLoading: (v) => set({ portfolioLoading: v }),
  setError: (e) => set({ error: e }),
}))
