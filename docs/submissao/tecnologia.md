# Conecta+: declaração de tecnologia

## IBM Bob

Usamos o IBM Bob (Bob IDE) como assistente de programação em par durante todo o desenvolvimento, a partir da nossa proposta escrita. O Bob leu o repositório, criou e editou arquivos e executou comandos nele. Quatro frentes:

1. **Motor e API.** Os pacotes Python do motor: scores M·I·C·A e quadrantes, distância ao backhaul mais próximo, o modelo financeiro (CapEx, payback e VPL, com e sem alavancas públicas), o otimizador de portfólio (MILP), o backtest 2021→2025, o schema Pydantic do município e as rotas FastAPI.
2. **Agente Granite.** O cliente do watsonx.ai, o orquestrador com *tool calling*, as ferramentas do motor que consultam a base SQLite e a rota `/chat`.
3. **Dados e ETL.** A pesquisa dos nomes exatos de campos, unidades e faixas típicas das fontes públicas (IBGE, elevação SRTM, Anatel e o Índice de Vulnerabilidade Social do IPEA) e o ETL de 12 passos que monta a base municipal.
4. **Frontend e documentação.** As telas em React, correções de build e os documentos de arquitetura, API e guia de uso.

## IBM watsonx.ai

O agente usa o **IBM Granite** (`ibm/granite-4-h-small`) pela API REST do watsonx.ai, de três formas:

1. **Chat com *tool calling*.** O Granite escolhe uma ferramenta do motor (ranking, otimização de portfólio, comparação de municípios, simulação de alavancas, menor orçamento para uma meta de alunos, consulta de escolas e de provedores), recebe os números calculados e redige a resposta. Os cenários que ele calcula viram um botão "Aplicar no painel".
2. **Agente regulatório com RAG.** Um índice local de busca textual sobre os textos oficiais (Leis 9.998/2000, 14.109/2020 e 14.172/2021 e a nota do TCU sobre a solução consensual da Telefônica) e a nossa documentação. Toda resposta lista as fontes.
3. **Textos de uma rodada.** Justificativa do município, leitura do portfólio, filtros em linguagem natural e os achados de "O que eu não estou vendo?". O motor calcula os fatos e o Granite os redige com temperatura 0.

Salvaguardas: o modelo nunca calcula; o resultado das ferramentas é tratado como dado, não como instrução; as credenciais ficam só no servidor; toda chamada de IA entra num log de auditoria (rota, latência, ferramentas e fontes, nunca o texto da pergunta); a demonstração pública limita as chamadas por visitante.

## O que não usamos

- **watsonx Orchestrate e watsonx.governance não estão integrados.** A orquestração é um laço próprio de *tool calling* em torno do Granite e a auditoria é um log local. A API publica a especificação OpenAPI, pronta para importação no Orchestrate.
- **IBM CPLEX** é aceito com uma única configuração (`CONECTA_SOLVER=cplex`) quando há licença. O protótipo roda o solver de código aberto CBC.

## Demais componentes

FastAPI, pandas, PuLP, React, Leaflet e Recharts, sobre dados públicos (IBGE, Censo Escolar 2024 do INEP, Anatel, NIC.br e CNES).
