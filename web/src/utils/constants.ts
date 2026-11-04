/** Constantes e dados estáticos usados em toda a aplicação. */

import type { FinancialParams, Objetivo } from '../api/client'

/** Premissas padrão do motor (mesmos valores de FinancialParams no backend; proposta §4.3). */
export const DEFAULT_PARAMS: FinancialParams = {
  custo_hp: 477,
  custo_backhaul_km: 61800,
  custo_ativacao: 500,
  adesao_pct: 0.25,
  arpu_mensal: 87.7,
  margem_ebitda: 0.4,
  wacc: 0.15,
  wacc_fust: 0.0325,
  anos_projeto: 10,
  aliquota_imposto: 0.34,
  arpu_escolar_mensal: 1200,
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

export const OBJETIVOS: { value: Objetivo; label: string; title: string }[] = [
  { value: 'retorno', label: 'Retorno', title: 'Maximiza o VPL dentro do orçamento' },
  { value: 'equilibrado', label: 'Equilíbrio', title: 'Combina impacto educacional (score I) e VPL' },
  { value: 'alunos', label: 'Alunos', title: 'Maximiza alunos em escolas sem internet' },
]

export const QUADRANT_NAMES: Record<string, string> = {
  Q1:  'Expandir já',
  Q2a: 'Expandir com alavancas',
  Q2b: 'Satélite / grant',
  Q3:  'Comercial / M&A',
  Q4:  'Monitorar',
}

export const QUADRANT_CSS_VARS: Record<string, string> = {
  Q1:  'var(--q1)',
  Q2a: 'var(--q2a)',
  Q2b: 'var(--q2b)',
  Q3:  'var(--q3)',
  Q4:  'var(--q4)',
}

export const QUADRANT_HEX: Record<string, string> = {
  Q1:  '#138a5b',
  Q2a: '#2b6cb0',
  Q2b: '#d9822b',
  Q3:  '#bf9000',
  Q4:  '#8a94a3',
}

export const VIEWS = [
  { id: 'painel',    label: 'Painel' },
  { id: 'mun',       label: 'Municípios' },
  { id: 'chat',      label: 'Agente' },
  { id: 'sol',       label: 'Solução' },
] as const

export type ViewId = typeof VIEWS[number]['id']

export type StatusEntrega = 'entregue' | 'parcial' | 'planejado'

/** Fluxo da solução, da fonte ao usuário. O status descreve o que existe hoje no repositório. */
export const FLUXO: { titulo: string; itens: { nome: string; status: StatusEntrega; desc: string }[] }[] = [
  {
    titulo: 'Fontes',
    itens: [
      { nome: 'IBGE', status: 'entregue', desc: 'Municípios, área, centroides, domicílios e renda per capita municipal (Censo 2022).' },
      { nome: 'INEP', status: 'entregue', desc: 'Censo Escolar 2024: escolas, matrículas e internet por escola.' },
      { nome: 'Anatel', status: 'entregue', desc: 'Acessos de banda larga fixa e telefonia móvel por município, empresa e porte; backhaul.' },
      { nome: 'CNES (SUS)', status: 'entregue', desc: 'Unidades Básicas de Saúde habilitadas, pela API de dados abertos.' },
      { nome: 'Ipeadata, SRTM e IBGE/SUDENE', status: 'entregue', desc: 'IVS por UF, elevação (OpenTopoData) e delimitação do Semiárido.' },
    ],
  },
  {
    titulo: 'Dados',
    itens: [
      { nome: 'ETL em 12 passos', status: 'entregue', desc: 'Baixa, valida contra o schema e classifica cada campo como real, aproximado ou neutro.' },
      { nome: 'Base SQLite', status: 'entregue', desc: '5.565 municípios, 137,8 mil escolas, 43,8 mil UBS e os provedores por município.' },
    ],
  },
  {
    titulo: 'Motor',
    itens: [
      { nome: 'Scores M·I·C·A', status: 'entregue', desc: 'Mercado, impacto educacional, custo e alavancas; classificação em 5 quadrantes.' },
      { nome: 'Business case', status: 'entregue', desc: 'CapEx, payback e VPL com alavancas FUST, TCU e ENEC e premissas editáveis.' },
      { nome: 'Otimizador de portfólio', status: 'entregue', desc: 'MILP por orçamento, escopo e objetivo. Usa o CBC; o IBM CPLEX é opcional (CONECTA_SOLVER=cplex, exige licença).' },
      { nome: 'Tecnologia de acesso', status: 'parcial', desc: 'Regra da proposta (FTTH, FWA 5G ou satélite) com comparação de custos; custos de FWA e satélite são ilustrativos.' },
      { nome: 'Construir × comprar', status: 'parcial', desc: 'Triagem de provedores locais com fibra instalada (Anatel); sem preço, qualidade da rede ou análise jurídica.' },
      { nome: 'Backtest com histórico real', status: 'entregue', desc: 'Fibra de dezembro de 2021 contra o último mês da Anatel, com taxa-base e lift; parcial nos demais indicadores.' },
    ],
  },
  {
    titulo: 'API',
    itens: [
      { nome: 'FastAPI', status: 'entregue', desc: '/municipios, /portfolio, /financial, /qualidade, /chat, /ia e /dados; OpenAPI em /docs.' },
    ],
  },
  {
    titulo: 'Interfaces e IA',
    itens: [
      { nome: 'Painel, mapa e ficha', status: 'entregue', desc: 'Filtros compartilhados, mapa por região, tabela, ficha executiva e PDF.' },
      { nome: 'Listas para secretarias', status: 'parcial', desc: 'Escolas sem internet, UBS e provedores por município, com CSV. Sem login nem contrato B2G.' },
      { nome: 'Módulo Saúde', status: 'parcial', desc: 'UBS por município (CNES) como indicador de demanda; não há dado de conectividade das UBS.' },
      { nome: 'Agente Granite (watsonx.ai)', status: 'entregue', desc: 'Chat com ferramentas de ranking, portfólio, comparação e provedores; justificativas e filtros em linguagem natural.' },
      { nome: 'Agente regulatório (RAG)', status: 'entregue', desc: 'Documentação do projeto e textos oficiais (Leis 9.998/2000, 14.109/2020, 14.172/2021 e nota do TCU). Sem lista nominal de municípios elegíveis.' },
      { nome: 'Auditoria de IA', status: 'entregue', desc: 'Log local de cada chamada (sem o texto da pergunta) com painel de uso, latência e ferramentas.' },
      { nome: 'watsonx.governance', status: 'planejado', desc: 'Exige uma instância do serviço IBM e credenciais próprias; hoje vale a auditoria local.' },
      { nome: 'watsonx Orchestrate', status: 'planejado', desc: 'Exige o serviço IBM; hoje a orquestração é própria (tool calling com Granite). A API expõe o OpenAPI para importação.' },
    ],
  },
]

/** Pesos reais de engine/conecta/scores/calculator.py (em % do score). */
export const PESOS_SCORE: {
  score: string
  titulo: string
  componentes: { nome: string; peso: number; campos: string[] }[]
}[] = [
  {
    score: 'M', titulo: 'Mercado',
    componentes: [
      { nome: 'Domicílios urbanos', peso: 25, campos: ['domicilios_urbanos'] },
      { nome: 'Renda média', peso: 20, campos: ['renda_media'] },
      { nome: 'Gap de fibra', peso: 20, campos: ['acessos_fibra'] },
      { nome: 'Share móvel Vivo', peso: 20, campos: ['market_share_vivo_movel'] },
      { nome: 'Concentração (HHI)', peso: 10, campos: ['hhi'] },
      { nome: 'Pequenas prestadoras', peso: 5, campos: ['ppp_share'] },
    ],
  },
  {
    score: 'I', titulo: 'Impacto educacional',
    componentes: [
      { nome: 'Matrículas públicas', peso: 20, campos: ['matriculas_publicas'] },
      { nome: 'Matrículas rurais', peso: 15, campos: ['matriculas_rurais_pct'] },
      { nome: 'Déficit de banda', peso: 35, campos: ['velocidade_medida_mbps', 'alunos_maior_turno_est'] },
      { nome: 'Escolas sem internet', peso: 15, campos: ['escolas_sem_internet_aprendizagem'] },
      { nome: 'Vulnerabilidade (IVS)', peso: 15, campos: ['ivs'] },
    ],
  },
  {
    score: 'C', titulo: 'Custo (alto = mais barato)',
    componentes: [
      { nome: 'Distância ao backhaul', peso: 50, campos: ['tem_backhaul_fibra'] },
      { nome: 'Densidade de domicílios', peso: 30, campos: ['domicilios_urbanos', 'area_km2'] },
      { nome: 'Elevação', peso: 20, campos: ['elevacao_media_m'] },
    ],
  },
  {
    score: 'A', titulo: 'Alavancas',
    componentes: [
      { nome: 'Acordo de migração (TCU)', peso: 50, campos: ['acordo_migracao'] },
      { nome: 'Elegibilidade FUST', peso: 30, campos: ['fust_elegivel'] },
      { nome: 'Escolas EACE', peso: 20, campos: ['eace_escolas'] },
    ],
  },
]

/** Fonte e próximo passo de cada campo do motor; o estado (real/aproximado/neutro) vem de /qualidade. */
export const FONTES_CAMPOS: Record<string, { rotulo: string; fonte: string; melhoria: string }> = {
  domicilios_urbanos:  { rotulo: 'Domicílios', fonte: 'IBGE SIDRA (Censo 2022)', melhoria: '—' },
  renda_media:         { rotulo: 'Renda per capita', fonte: 'IBGE, Censo 2022 (SIDRA 10295)', melhoria: '—' },
  acessos_fibra:       { rotulo: 'Acessos de fibra', fonte: 'Anatel, banda larga fixa (pessoa física)', melhoria: '—' },
  acessos_total_bl:    { rotulo: 'Acessos de banda larga', fonte: 'Anatel, banda larga fixa (pessoa física)', melhoria: '—' },
  market_share_vivo_movel: { rotulo: 'Share móvel Vivo', fonte: 'Anatel, acessos móveis por município (sem M2M)', melhoria: '—' },
  hhi:                 { rotulo: 'HHI de banda larga', fonte: 'Anatel, acessos por grupo econômico', melhoria: '—' },
  ppp_share:           { rotulo: 'Pequenas prestadoras', fonte: 'Anatel, acessos por porte da prestadora', melhoria: '—' },
  area_km2:            { rotulo: 'Área', fonte: 'IBGE', melhoria: '—' },
  elevacao_media_m:    { rotulo: 'Elevação', fonte: 'SRTM 90m no centroide (OpenTopoData)', melhoria: 'Média zonal sobre o polígono municipal.' },
  matriculas_publicas: { rotulo: 'Matrículas públicas', fonte: 'INEP, Censo Escolar 2024', melhoria: '—' },
  matriculas_rurais_pct: { rotulo: 'Matrículas rurais', fonte: 'INEP, Censo Escolar 2024', melhoria: '—' },
  velocidade_medida_mbps: { rotulo: 'Velocidade medida', fonte: 'NIC.br / Medidor Educação Conectada', melhoria: 'Sem base aberta por município; depende de acordo com o NIC.br.' },
  alunos_maior_turno_est: { rotulo: 'Alunos no maior turno', fonte: 'INEP (estimativa)', melhoria: '—' },
  escolas_sem_internet_aprendizagem: { rotulo: 'Escolas sem internet', fonte: 'INEP, Censo Escolar 2024', melhoria: '—' },
  alunos_sem_internet: { rotulo: 'Alunos em escolas sem internet', fonte: 'INEP, Censo Escolar 2024', melhoria: '—' },
  ivs:                 { rotulo: 'IVS', fonte: 'Ipeadata, nível estadual', melhoria: 'O Atlas municipal não tem download aberto acessível.' },
  tem_backhaul_fibra:  { rotulo: 'Backhaul de fibra', fonte: 'Anatel (Base dos Dados)', melhoria: 'Traçado da rede (hoje só presença por município).' },
  acordo_migracao:     { rotulo: 'Acordo TCU', fonte: 'TCU/Anatel (lista nominal não aberta)', melhoria: 'Lista dos 121 municípios do acordo (pedido à Anatel).' },
  fust_elegivel:       { rotulo: 'Elegibilidade FUST', fonte: 'Editais FUST/BNDES', melhoria: 'Lista de municípios dos editais.' },
  eace_escolas:        { rotulo: 'Escolas EACE', fonte: 'EACE / Aprender Conectado', melhoria: 'Base de escolas atendidas por município.' },
  semiarido:           { rotulo: 'Semiárido', fonte: 'IBGE/SUDENE, lista de 2022', melhoria: '—' },
  ubs:                 { rotulo: 'UBS', fonte: 'CNES (API de dados abertos do SUS)', melhoria: 'Conectividade de cada UBS.' },
}

export const ROADMAP: { titulo: string; status: StatusEntrega | 'proximo'; itens: string[] }[] = [
  {
    titulo: 'Entregue',
    status: 'entregue',
    itens: [
      'Base nacional com dados reais de mercado (Anatel), renda municipal, escolas e UBS',
      'Scores M·I·C·A, quadrantes e business case com alavancas e premissas editáveis',
      'Portfólio por orçamento, escopo e objetivo (CBC; CPLEX opcional)',
      'Painel com mapa por região, ficha, PDF e listas CSV para secretarias',
      'Backtest com histórico real da Anatel',
      'Agente Granite com RAG sobre textos oficiais e painel de auditoria',
    ],
  },
  {
    titulo: 'Parcial: a evoluir',
    status: 'parcial',
    itens: [
      'Custos de FWA 5G e satélite validados com a engenharia',
      'Construir × comprar com preço, qualidade da rede e análise jurídica',
      'Módulo Saúde com a conectividade de cada UBS',
      'Listas para secretarias com login e contrato B2G',
    ],
  },
  {
    titulo: 'Próximo: dados sem fonte aberta',
    status: 'proximo',
    itens: [
      'Lista nominal do Acordo TCU, dos municípios FUST e das escolas EACE',
      'Velocidade medida por município (NIC.br)',
      'IVS municipal (Atlas da Vulnerabilidade Social)',
      'Elevação média por município (hoje no centroide)',
    ],
  },
  {
    titulo: 'Planejado: depende de serviços e parcerias',
    status: 'planejado',
    itens: [
      'watsonx Orchestrate e watsonx.governance (serviços IBM)',
      'IBM Decision Optimization (CPLEX) em produção',
      'Conecta Gov (MCom/BNDES)',
      'Integração com os sistemas de planejamento da operadora',
    ],
  },
]

export const RISCOS: string[] = [
  'Campos neutros não diferenciam municípios: o score A depende de listas ainda não carregadas (Acordo TCU, FUST e EACE) e o déficit de banda não tem velocidade medida.',
  'Premissas financeiras da proposta: com os padrões o payback simples não cai abaixo de ~5,7 anos e o VPL é negativo (editáveis em Premissas).',
  'Backtest real: a classificação Q1/Q2a prevê o crescimento de fibra pouco acima do acaso (lift entre 1,0 e 1,2). Os scores precisam de revisão antes de sustentar decisões.',
  'Os custos de FWA e satélite são ilustrativos: a recomendação de tecnologia segue a regra da proposta, não uma otimização de custos.',
  'Censo Escolar 2024 sem latitude/longitude das escolas: a análise é por município, não por escola.',
  'Backhaul só como presença por município, sem traçado da rede.',
]

export const ROI_ROWS: { label: string; value: string; highlight?: boolean }[] = [
  { label: 'Otimização do CapEx de expansão (3–5% sobre ~R$ 2 bi)', value: 'R$ 60–100 mi' },
  { label: 'Redução do custo de dívida (FUST, ~R$ 300 mi/ano)',      value: 'R$ 24–30 mi' },
  { label: 'Monetização do CapEx regulatório (20 municípios/ano)',    value: '~R$ 15 mi' },
  { label: 'Eficiência de planejamento (−75% do tempo)',              value: '~R$ 3,5 mi' },
  { label: 'Total',                                                   value: 'R$ 102,5–148,5 mi', highlight: true },
]

/** Números de mercado da proposta (docs/PROPOSTA_DETALHADA.md); não são calculados pelo app. */
export const MERCADO_KPIS: { label: string; value: string; detail: string }[] = [
  { label: 'Cobertura Vivo hoje',       value: '8%',        detail: '453 de 5.570 municípios' },
  { label: 'CapEx Vivo 2025',           value: 'R$ 9,27 bi', detail: '15,6% da receita líquida' },
  { label: 'Brasileiros sem internet',  value: '28 mi',     detail: '19% dos domicílios rurais' },
  { label: 'Escolas sem conexão',       value: '~9 mil',    detail: 'Norte, Nordeste, rural, indígena' },
]

/** Sugestões do chat: cada uma exercita uma ferramenta do agente e tem resposta com os dados da base. */
export const CHAT_CHIPS = [
  'Quais municípios do semiárido têm mais alunos sem internet por real investido?',
  'Onde investir R$ 100 milhões no Nordeste para conectar o maior número de alunos?',
  'Compare Salvador (BA) e Feira de Santana (BA): qual compensa mais investir?',
  'Existe algum município do semiárido com payback abaixo de 6 anos?',
  'Qual a diferença entre os quadrantes Q1 e Q2a?',
  'Quais campos do motor ainda não têm dado real?',
]
