# Guia de uso do Conecta+

Este guia explica como usar o painel e o assistente. Para fórmulas e premissas, veja a referência técnica do motor.

## Telas

O menu lateral tem quatro telas:

- **Painel**: KPIs do portfólio, mapa dos municípios, botões de quadrante e histograma de payback.
- **Municípios**: tabela com busca, filtros, ordenação, favoritos e seleção para o portfólio.
- **Agente**: chat com o assistente Conecta+ (IBM Granite no watsonx.ai).
- **Solução**: arquitetura, ROI estimado e fases de entrega.

Clicar em um município abre a **ficha executiva** com scores, quadrante, CapEx, payback e VPL.

## Controles do topo

- **Orçamento**: limite de CapEx (R$ milhões) usado para montar o portfólio.
- **Alavancas**: Subsídio FUST/BNDES, Backhaul Acordo TCU e Receita âncora ENEC. Ligar uma alavanca recalcula payback e municípios viáveis.
- **Ctrl+K** (ou Cmd+K): paleta de comandos. Navega entre telas, aplica o cenário completo e abre a ficha de um município pelo nome.

## KPIs do Painel

- **Payback médio do portfólio**: anos para recuperar o CapEx, médio ponderado pelo CapEx.
- **Municípios no portfólio**: quantos municípios cabem no orçamento.
- **Alunos conectados**: alunos atendidos pelos municípios do portfólio.
- **CapEx alocado**: quanto do orçamento foi usado.

## Quadrantes

Os scores M (Mercado), I (Impacto educacional), C (Custo) e A (Alavancas) vão de 0 a 100. Em C, valor alto significa custo baixo.

| Quadrante | Perfil | Ação |
|---|---|---|
| Q1 | M alto e I alto | Expandir já |
| Q2a | M baixo, I alto, com alavancas | Expandir com alavancas |
| Q2b | M baixo, I alto, sem alavancas | Satélite / grant |
| Q3 | M alto e I baixo | Comercial / M&A |
| Q4 | M baixo e I baixo | Monitorar |

## Assistente (aba Agente)

Exemplos de perguntas que ele responde com dados do motor:

- "Qual município da Bahia você recomenda? Quero o menor payback."
- "Tenho R$ 150 milhões para investir em Pernambuco. Como distribuo?"
- "Compare Feira de Santana e Vitória da Conquista."
- "Quantas escolas estão sem internet em Porto Alegre?"
- "Como é calculado o score C?"

O assistente conhece a tela em que você está (município aberto, orçamento e filtros), então pode responder "e este município?".
Cada resposta mostra as fontes usadas. Uma recomendação do assistente é uma priorização do modelo, não uma decisão de investimento.

## Qualidade dos dados

Alguns campos não têm fonte pública municipal e entram no motor como valor neutro (igual para todos os municípios) ou aproximado:

- **Neutros**: participação de mercado da Vivo, HHI e share de pequenas prestadoras (Anatel), velocidade medida (NIC.br), acordo de migração, elegibilidade FUST e escolas EACE.
- **Aproximados**: renda média (por UF), IVS (por UF) e elevação (SRTM no centroide do município).

Campos neutros não diferenciam municípios; a recomendação deve ser lida com essa limitação. Quando a base real não está disponível, o app mostra um aviso de dados demonstrativos.
