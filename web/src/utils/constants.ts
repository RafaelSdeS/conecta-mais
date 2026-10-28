/** Constantes e dados estáticos usados em toda a aplicação. */

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

export const AGENT_DESCRIPTIONS: { name: string; description: string }[] = [
  {
    name: 'Dados',
    description:
      'Ingestão (Anatel CKAN, Base dos Dados, INEP, IBGE), validação e saída em GeoParquet particionado por UF.',
  },
  {
    name: 'Geo-Analytics',
    description:
      'Calcula scores M, I, C, distâncias até o backhaul e déficit de banda; classifica em quadrantes.',
  },
  {
    name: 'Financiamento e Regulação',
    description:
      'Verifica elegibilidade FUST e Acordo TCU, modela contrato B2G; devolve alavancas, WACC subsidiado e dedução de CapEx.',
  },
  {
    name: 'Simulação e Otimização',
    description:
      'MILP (mochila multiobjetivo): maximiza Σ(wM·M + wI·I)·x sujeito a Σ CapEx·x ≤ Orçamento.',
  },
  {
    name: 'Justificativa e Governança',
    description:
      'Explicações em linguagem natural com proveniência e incerteza via Granite (watsonx.ai) e watsonx.governance.',
  },
]

export const ROI_ROWS: { label: string; value: string; highlight?: boolean }[] = [
  { label: 'Otimização do CapEx de expansão (3–5% sobre ~R$ 2 bi)', value: 'R$ 60–100 mi' },
  { label: 'Redução do custo de dívida (FUST, ~R$ 300 mi/ano)',      value: 'R$ 24–30 mi' },
  { label: 'Monetização do CapEx regulatório (20 municípios/ano)',    value: '~R$ 15 mi' },
  { label: 'Eficiência de planejamento (−75% do tempo)',              value: '~R$ 3,5 mi' },
  { label: 'Total',                                                   value: 'R$ 102,5–148,5 mi', highlight: true },
]

export const DELIVERY_PHASES: { title: string; items: string[] }[] = [
  {
    title: 'Fase 1: MVP (3 meses)',
    items: ['Bahia, 5 agentes', 'Score duplo e alavancas', 'Dashboard e chat'],
  },
  {
    title: 'Fase 2: escala (6–12 meses)',
    items: ['5.570 municípios', 'FTTH, FWA 5G e satélite', 'Motor de M&A (build vs. buy)'],
  },
  {
    title: 'Fase 3: expansão (12–24 meses)',
    items: ['Módulo Saúde (UBSs)', 'Portal B2G para secretarias', 'Conecta Gov (MCom/BNDES)'],
  },
  {
    title: 'Riscos',
    items: [
      'Censo sem lat/long: join via CO_ENTIDADE',
      'Sem Mbps real: NIC.br/SIMEC',
      'Backhaul sem traçado: OSM e incerteza explícita',
      'Metas TCU fixas: parâmetros exógenos',
    ],
  },
]

export const SOLUTION_KPIS: { label: string; value: string; detail: string }[] = [
  { label: 'Cobertura Vivo hoje',       value: '8%',        detail: '453 de 5.570 municípios' },
  { label: 'CapEx Vivo 2025',           value: 'R$ 9,27 bi', detail: '15,6% da receita líquida' },
  { label: 'Brasileiros sem internet',  value: '28 mi',     detail: '19% dos domicílios rurais' },
  { label: 'Escolas sem conexão',       value: '~9 mil',    detail: 'Norte, Nordeste, rural, indígena' },
]

export const CHAT_CHIPS = [
  'Quais cidades do semiárido maximizam estudantes conectados por real investido com payback < 5 anos?',
  'Por que priorizar o município X sobre o Y?',
  'Como funciona o FUST?',
  'O que é o Acordo TCU?',
]
