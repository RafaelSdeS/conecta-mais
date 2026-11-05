/**
 * Cliente HTTP para a API do Conecta+ (FastAPI em localhost:8000).
 * Em dev o Vite faz proxy de /api → http://localhost:8000.
 */

import { avisoNumeros } from '../utils/chatService'

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

/** POST dos endpoints de IA: devolve a mensagem de erro do backend (campo detail). */
async function postIa<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().then((j) => j?.detail).catch(() => undefined)
    throw new Error(typeof detail === 'string' ? detail : `Falha na IA (HTTP ${res.status})`)
  }
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
  // recortes e métrica de impacto
  alunos_sem_internet: number
  total_escolas: number
  ubs: number
  semiarido: boolean
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
  wacc_fust: number
  anos_projeto: number
  aliquota_imposto: number
  arpu_escolar_mensal?: number
}

export interface CapexResult {
  acesso: number
  backhaul: number
  ativacao: number
  total: number
}

export interface TecnologiaLinha {
  tecnologia: 'FTTH' | 'FWA 5G' | 'Satélite'
  capex_mi: number
  payback_anos: number | null
  vpl_mi: number
}

export interface FinancialResult {
  /** Comparação de tecnologias (custos de FWA e satélite são ilustrativos). */
  tecnologias?: TecnologiaLinha[]
  tecnologia_recomendada?: string
  regra?: string
  aviso?: string
  id_municipio: string
  capex: CapexResult
  receita_anual: number
  ebitda_anual: number
  payback_anos: number
  npv: number
  sensitivity: { adesao_pct: number; payback_anos: number }[]
}

export type Objetivo = 'retorno' | 'equilibrado' | 'alunos'

export interface PortfolioRequest {
  budget: number
  lambda_?: number
  max_payback?: number
  uf?: string
  semiarido?: boolean
  regiao?: string
  objetivo?: Objetivo
  alavancas?: Alavancas
  params?: FinancialParams
  weights?: ScoreWeights
}

export interface FinanceiroLinha {
  id_municipio: string
  capex: number
  payback: number | null
  npv: number
}

export interface ResumoPortfolio {
  payback_medio: number
  vpl_total: number
}

export interface CampoQualidade {
  campo: string
  tipo: 'real' | 'aproximado' | 'neutro'
  cobertura: number
}

export interface PortfolioResult {
  alunos_atendidos: number
  escolas_atendidas: number
  vpl_total: number
  efeito_alavancas: { com: ResumoPortfolio; sem: ResumoPortfolio } | null
  financeiro: FinanceiroLinha[]
  municipios: Municipio[]
  capex_total: number
  payback_medio: number
  score_total: number
  status: string
  n_candidatos: number
  n_selecionados: number
}

export interface Provedor {
  empresa: string
  grupo: string
  porte: string
  acessos: number
  acessos_fibra: number
}

export interface MercadoMunicipio {
  domicilios: number
  penetracao_fibra_total: number
  penetracao_fibra_ppp: number
  n_provedores: number
  candidatas_compra_ou_parceria: { empresa: string; cnpj: string; acessos_fibra: number; acessos: number; fibra_sobre_domicilios: number }[]
  provedores: Provedor[]
  leitura: string
  aviso: string
}

export interface UbsLinha { codigo_cnes: string; nome: string; lat: number | null; lon: number | null }

export interface EscolaSemInternet { codigo_inep: string; escola: string; municipio: string; uf: string }

export interface Auditoria {
  total: number
  ok: number
  taxa_ok: number | null
  latencia_media_ms: number | null
  latencia_p95_ms: number | null
  com_numeros_nao_confirmados: number
  por_endpoint: Record<string, number>
  ferramentas: Record<string, number>
  ultimas: { ts: string; endpoint: string; modelo: string; ok: boolean; latencia_ms: number; ferramentas?: string[]; erro?: string }[]
}

type TextoIa = { texto: string; numeros_nao_confirmados?: string[] }

const comAviso = (r: TextoIa): TextoIa => ({ ...r, texto: r.texto + avisoNumeros(r.numeros_nao_confirmados) })

export interface LimiarBacktest {
  limiar: number
  precision: number
  recall: number
  f1: number
  cresceram: number
  taxa_base: number
  lift: number
}

export interface BacktestResult {
  status: string
  descricao?: string
  taxa_base?: number
  lift?: number
  limiares?: LimiarBacktest[]
  /** O backtest roda sobre dados demonstrativos (sem histórico real de 2021). */
  fonte?: 'demonstrativo' | 'real'
  precision: number
  recall: number
  f1: number
  total_q1_q2a_2021: number
  total_cresceram: number
  acertados: number
  threshold_crescimento: number
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export type FonteDados = 'real' | 'mock'

export interface FiltrosIA {
  uf: string | null
  quadrante: string | null
  busca: string | null
  apenas_portfolio: boolean
}

export const api = {
  getProvedores: (id: string) => get<MercadoMunicipio>(`/dados/provedores/${id}`),

  getUbs: (id: string) => get<{ total: number; ubs: UbsLinha[] }>(`/dados/ubs?codigo_municipio=${id}&limite=100`),

  getEscolasSemInternet: (id: string) =>
    get<{ total_sem_internet: number; escolas: EscolaSemInternet[] }>(
      `/dados/escolas/sem-internet?codigo_municipio=${id}&limite=100`,
    ),

  getAuditoria: () => get<Auditoria>('/ia/auditoria?limite=10'),

  getQualidade: () => get<{ fonte_dados: FonteDados; campos: CampoQualidade[] }>('/qualidade'),

  getHealth: () => get<{ status: string; fonte_dados: FonteDados }>('/health'),

  postJustificativa: (id_municipio: string) =>
    postIa<TextoIa>('/ia/justificativa', { id_municipio }).then(comAviso),

  postPortfolioNarrativa: (ids: string[], orcamento_mi: number) =>
    postIa<TextoIa>('/ia/portfolio-narrativa', { ids, orcamento_mi }).then(comAviso),

  postFiltros: (texto: string) => postIa<FiltrosIA>('/ia/filtros', { texto }),

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
