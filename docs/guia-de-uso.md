# Guia de uso do Conecta+

Este guia explica como usar o painel e o assistente. Para fórmulas e premissas, veja a referência técnica do motor.

## Telas

O app abre na **tela de início**, com o problema em números da base real, o que cada tela faz e os quadrantes. **Abrir o painel** entra no app; o botão **Início**, no menu lateral, volta para ela.

O menu lateral tem quatro telas:

- **Painel**: KPIs do portfólio, filtros, mapa dos municípios, botões de quadrante e histograma de payback.
- **Municípios**: tabela com busca, filtros, ordenação, favoritos e seleção para o portfólio.
- **Agente**: chat com o assistente Conecta+ (IBM Granite no watsonx.ai).
- **Solução**: o que o Conecta+ faz hoje, com números da base real (por região), o fluxo da fonte ao agente com o estado de cada parte (entregue, parcial ou planejado), a composição dos scores, a qualidade de cada fonte de dados, o roadmap e os limites conhecidos. O ROI e os números de mercado são estimativas da proposta e aparecem rotulados; o backtest usa o histórico real da Anatel e mostra o próprio limite (lift).

Clicar em um município abre a **ficha executiva**: situação no plano, decisão do gestor, scores, quadrante, CapEx, payback e VPL.

## Cenário (barra do topo)

O cenário é calculado no servidor e vale para o Painel, a tabela, o mapa, a ficha, o PDF e o chat.

- **Orçamento**: limite de CapEx (R$ milhões) usado para montar o portfólio.
- **Escopo**: vem dos filtros (UF, região, Semiárido); o portfólio só escolhe municípios desse escopo.
- **Objetivo**: *Retorno* maximiza o VPL, *Equilíbrio* combina impacto educacional e VPL, *Alunos* maximiza os alunos em escolas sem internet.
- **Premissas**: ARPU, adesão, margem EBITDA, WACC e custos. Com as premissas padrão, o payback simples não cai abaixo de cerca de 5,7 anos e o VPL é negativo; ajuste as premissas para explorar cenários viáveis.
- **Alavancas**:
  - *Subsídio FUST/BNDES*: custo de capital menor; melhora o VPL, mas não altera o payback simples.
  - *Backhaul Acordo TCU*: zera o CapEx de backhaul dos municípios do acordo. Fica desabilitada quando a lista de municípios não está carregada.
  - *Receita âncora ENEC*: receita B2G por escola sem internet para aprendizagem.
  Os KPIs mostram o efeito das alavancas sobre o mesmo portfólio.
- **Ctrl+K** (ou Cmd+K): paleta de comandos. Navega entre telas, aplica o cenário completo, abre a ficha de um município e interpreta pedidos em linguagem natural.

## Filtros e mapa

Os filtros (busca, UF, região, Semiárido, quadrante, decisão, só portfólio, só favoritos) são os mesmos no Painel e em Municípios e valem para o mapa, as contagens de quadrante, o histograma e a tabela.
Ao filtrar, o mapa enquadra o recorte. No mapa:

- **Regiões**: os botões Brasil, Norte, Nordeste, Sudeste, Sul e Centro-Oeste ficam sobre o mapa, com a contagem de municípios de cada uma. Escolher uma região filtra o mapa, a tabela, o portfólio e o chat; clicar de novo (ou em Brasil) volta ao país todo. É o mesmo filtro de região da barra de filtros.

- **Colorir por** quadrante, payback, score total, alunos sem internet ou decisão (a legenda muda junto).
- **Camadas**: municípios com backhaul de fibra (Anatel) e bolhas de alunos sem internet.
- Passar o mouse mostra score, payback, CapEx, VPL e alunos; passar o mouse numa linha da tabela destaca o município no mapa; abrir a ficha leva o mapa até ele.

Links diretos: `/?uf=BA&semiarido=1`, `/?regiao=Nordeste&quadrante=Q1`, `/?view=sol` (aba Solução) e `/?m=<código IBGE>` (abre a ficha).

## Situação no plano

No topo da ficha, uma frase diz se o município entrou no plano do cenário atual e, se ficou fora, por quê:

- **Entrou**: quanto do orçamento ele usa.
- **Fora do escopo**: está fora da UF, região ou Semiárido escolhidos.
- **Acima do teto**: payback acima de 10 anos (ou não se paga no horizonte do projeto).
- **Sem espaço**: custa mais do que sobra no orçamento.
- **Preterido**: cabe no orçamento, mas o objetivo escolhido priorizou outros municípios.

O botão **O que mudaria para incluir?** recalcula o mesmo portfólio com o município forçado e mostra quem
sairia e a variação de alunos atendidos, VPL e CapEx. Para municípios acima do teto, testa o payback com
todas as alavancas ligadas.

## Decisão

Na ficha, **Registrar decisão** abre um formulário: aprovar, adiar ou descartar, motivo (obrigatório),
observação de campo e responsável (o nome fica lembrado neste navegador). O cenário atual vai junto e o
servidor recalcula CapEx, payback e VPL com ele; a justificativa por IA, se já gerada, também é guardada.
Aprovar um município fora do plano, ou descartar um que está no plano, mostra um aviso: a decisão fica
registrada como exceção, com o motivo.

Nada é apagado: uma nova decisão substitui a vigente e o histórico fica na ficha. A tabela mostra a
decisão vigente em uma coluna e o filtro **Decisão** separa aprovados, adiados, descartados e pendentes.
Sem conexão com o servidor não é possível registrar decisões. Não há login no MVP: o responsável é
informado pelo gestor.

## Ficha e PDF

O botão **Imprimir / PDF** gera uma página com cabeçalho (data, fonte dos dados, cenário e campos neutros), diagnóstico, business case e a justificativa por IA, se já tiver sido gerada. Na janela de impressão, escolha "Salvar como PDF". A ficha impressa inclui a situação no plano e a decisão vigente.

## Dossiê do recorte

O botão **Dossiê (PDF)**, no Painel, gera uma página para o comitê com o cenário, o resumo do plano
(com o efeito das alavancas), a leitura do plano por IA (se gerada no Painel para o mesmo cenário), as
decisões registradas no recorte (marcando as exceções ao plano), a tabela dos municípios do plano com a
decisão de cada um e os limites dos dados.

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
- "Quais cidades do semiárido têm mais alunos conectados por real investido?" (se nenhum município atender a uma restrição, como payback abaixo de 5 anos, o assistente avisa antes de listar os mais próximos)
- "Quantas escolas estão sem internet em Porto Alegre?"
- "Como é calculado o score C?"

O assistente conhece a tela em que você está (município aberto, orçamento, filtros, alavancas e premissas), então pode responder "e este município?" e calcula com o mesmo cenário.
Cada resposta mostra as fontes usadas. Uma recomendação do assistente é uma priorização do modelo, não uma decisão de investimento.

## Qualidade dos dados

Alguns campos não têm fonte pública municipal e entram no motor como valor neutro (igual para todos os municípios) ou aproximado:

- **Neutros**: participação de mercado da Vivo, HHI e share de pequenas prestadoras (Anatel), velocidade medida (NIC.br), acordo de migração (a lista nominal dos municípios não é publicada em formato aberto, por isso a alavanca TCU fica desabilitada), elegibilidade FUST e escolas EACE.
- **Aproximados**: renda média (por UF), IVS (por UF) e elevação (SRTM no centroide do município).

Campos neutros não diferenciam municípios; a recomendação deve ser lida com essa limitação. Quando a base real não está disponível, o app mostra um aviso de dados demonstrativos.
