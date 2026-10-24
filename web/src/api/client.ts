/**
 * Cliente HTTP para a API do Conecta+ (FastAPI em localhost:8000).
 * Em dev o Vite faz proxy de /api → http://localhost:8000.
 */

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Municipio {
  id_municipio: string
  nome: string
  uf: string
  lat: number
  lon: number
  // score M
  domicilios_urbanos: number
  renda_media: number
  acessos_fibra: number
  acessos_total_bl: number
  market_share_vivo_movel: number
  hhi: number
  ppp_share: number          // Anatel — porte == "Pequeno"
  // score C
  area_km2: number           // IBGE SIDRA tabela 1301
  elevacao_media_m: number   // SRTM 90m
  dist_backhaul_km: number | null
  // score I
  matriculas_publicas: number
  matriculas_rurais_pct: number
  velocidade_medida_mbps: number
  alunos_maior_turno_est: number
  escolas_sem_internet_aprendizagem: number
  ivs: number
  // score A
  tem_backhaul_fibra: boolean
  acordo_migracao: boolean
  ano_backhaul: number | null
  fust_elegivel: boolean
  eace_escolas: number
  // calculados pelo engine
  score_M: number
  score_I: number
  score_C: number
  score_A: number
  score_total: number
  quadrante: string
}

export interface ScoreWeights {
  w_M: number
  w_I: number
  w_C: number
  w_A: number
}

export interface Alavancas {
  backhaul_comprometido: boolean
  fust_reembolsavel: boolean
  receita_escolar: boolean
}

export interface FinancialParams {
  custo_hp: number
  custo_backhaul_km: number
  custo_ativacao: number
  adesao_pct: number
  arpu_mensal: number
  margem_ebitda: number
  wacc: number
  anos_projeto: number
  arpu_escolar_mensal: number
}

export interface FinancialResult {
  id_municipio: string
  capex_acesso: number
  capex_backhaul: number
  capex_ativacao: number
  capex_total: number
  receita_anual: number
  ebitda_anual: number
  payback_anos: number
  vpl: number
  sensitivity: { adesao_pct: number; payback_anos: number }[]
}

export interface PortfolioRequest {
  budget: number
  lambda_: number
  max_payback: number
  uf?: string
  alavancas: Alavancas
  params: FinancialParams
  weights?: ScoreWeights
}

export interface PortfolioResult {
  municipios: Municipio[]
  capex_total: number
  payback_medio: number
  score_total: number
  status: string
}

export interface BacktestResult {
  precision: number
  recall: number
  total_q1_q2_2021: number
  total_cresceram: number
  acertados: number
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const api = {
  getMunicipios: (params?: { uf?: string; quadrante?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v != null) as [string, string][]
    ).toString()
    return get<Municipio[]>(`/municipios${qs ? `?${qs}` : ''}`)
  },

  postScores: (weights: ScoreWeights) =>
    post<Municipio[]>('/scores', { weights }),

  postFinancial: (id_municipio: string, params: FinancialParams, alavancas: Alavancas) =>
    post<FinancialResult>('/financial', { id_municipio, params, alavancas }),

  postPortfolio: (req: PortfolioRequest) =>
    post<PortfolioResult>('/portfolio', req),

  getBacktest: () =>
    get<BacktestResult>('/backtest'),
}
