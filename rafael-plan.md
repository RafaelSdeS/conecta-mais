# Conecta+ — Plano de Implementação (Rafael)

## Visão Geral

Implementar o motor de decisão do Conecta+: scores multidimensionais (M, I, C, A), cálculo
de distâncias ao backhaul, ferramenta financeira (payback/VPL/sensibilidade), ferramenta de
otimização de portfólio (PuLP + CBC) e backtest 2021→2025. Tudo exposto como API FastAPI,
consumida por um app React (Vite + Tailwind) no mesmo monorepo.

**Estrutura do monorepo:**
```
conecta+/
  engine/          ← backend Python
    conecta/
      data/        ← carga e schema dos dados
      scores/      ← cálculo de M, I, C, A, quadrantes
      geo/         ← distâncias ao backhaul
      financial/   ← payback, VPL, sensibilidade
      optimizer/   ← portfólio PuLP/CBC
      backtest/    ← backtest 2021→2025
    api/           ← FastAPI (routers por domínio)
    tests/         ← pytest
    pyproject.toml
  web/             ← frontend React
    src/
      pages/       ← ScoreMap, Simulator
      components/  ← tabelas, gráficos, filtros
      api/         ← chamadas fetch tipadas
    vite.config.ts
    tailwind.config.ts
  PROPOSTA_DETALHADA.md
  TEAM.md
  rafael-plan.md
```

**Decisões técnicas:**
- Backend: Python 3.11, FastAPI, Pydantic v2, Uvicorn
- Solver: PuLP + CBC (open-source, sem licença)
- Dados mock: CSV com ~50 municípios reais (IBGE) + arquivo de backhaul da Anatel
- Frontend: Vite, React 18, Tailwind CSS, TypeScript
- Comunicação: JSON sobre HTTP; CORS habilitado para `localhost:5173`

**Dependências entre sub-tarefas:**
Sub-tarefa 1 (estrutura + dados) é pré-requisito de todas as demais.
Sub-tarefas 2, 3, 4 e 5 podem ser feitas em qualquer ordem após a 1.
Sub-tarefa 6 (API FastAPI) conecta o backend ao frontend.
Sub-tarefa 7 (React) consome a API da sub-tarefa 6.
Sub-tarefa 8 (backtest) é independente e pode ser feita por último.

---

## Sub-Tarefa 1 — Estrutura do Projeto e Dados Mock

**Status:** `[ ] pending`

**Intent:**
Criar o esqueleto do monorepo e um dataset sintético baseado em municípios reais para que
todos os módulos seguintes tenham uma entrada concreta para rodar e testar sem depender do
pipeline do Joel.

**Expected Outcomes:**
- `engine/pyproject.toml` com todas as dependências declaradas
- `engine/conecta/data/schema.py` com os modelos Pydantic de `Municipio` e `Escola`
- `engine/conecta/data/loader.py` com função `load_municipios(path) -> pd.DataFrame` que valida o schema
- `engine/data/mock_municipios.csv` com ~50 municípios reais (campos: id_municipio, nome, uf, lat, lon, domicilios_urbanos, renda_media, acessos_fibra, acessos_total_bl, market_share_vivo_movel, hhi, matriculas_publicas, matriculas_rurais_pct, velocidade_medida_mbps, alunos_maior_turno_est, escolas_sem_internet_aprendizagem, ivs, tem_backhaul_fibra, acordo_migracao, ano_backhaul, fust_elegivel, eace_escolas)
- `engine/data/mock_backhaul.csv` com os municípios que já têm backhaul de fibra (lat, lon, id_municipio)
- `web/` scaffoldado com Vite + React + TypeScript + Tailwind

**Todo List:**
1. Criar `engine/pyproject.toml` com deps: fastapi, uvicorn, pandas, geopandas, scipy, pulp, pyarrow, pydantic, pytest, ruff
2. Criar `engine/conecta/__init__.py` e subpacotes (pastas com `__init__.py`)
3. Criar `engine/conecta/data/schema.py` com Pydantic BaseModel para `Municipio`
4. Criar `engine/conecta/data/loader.py` com `load_municipios()`
5. Montar `engine/data/mock_municipios.csv` com ~50 municípios reais variados por região
6. Montar `engine/data/mock_backhaul.csv` com municípios que já têm fibra (fonte pública Anatel)
7. Fazer scaffold do React com `npm create vite@latest web -- --template react-ts` e instalar Tailwind
8. Criar `web/src/api/client.ts` com `BASE_URL` e helpers `get/post` tipados
9. Criar `engine/tests/test_loader.py` — testa que o CSV carrega sem erros de schema

**Relevant Context:**
- Schema de campos definido em §4.1 e §6.1 da `PROPOSTA_DETALHADA.md`
- Campos-chave de reconciliação: `id_municipio` (IBGE 7 dígitos), `CO_ENTIDADE` (escolas — para integração futura com Joel)
- A Anatel publica o CSV "Infraestrutura: Backhaul em municípios" em dados.gov.br

---

## Sub-Tarefa 2 — Módulo de Scores (M, I, C, A)

**Status:** `[ ] pending`

**Intent:**
Implementar o coração do sistema: os quatro índices normalizados de 0–100 e a classificação
de cada município nos quadrantes estratégicos (Q1–Q4).

**Expected Outcomes:**
- `engine/conecta/scores/calculator.py` com função `calculate_scores(df: pd.DataFrame, weights: ScoreWeights) -> pd.DataFrame`
  - Retorna as colunas: `score_M`, `score_I`, `score_C`, `score_A`, `score_total`, `quadrante`
- `engine/conecta/scores/models.py` com `ScoreWeights` (Pydantic) contendo pesos w_M, w_I, w_C, w_A (somam 1.0)
- Quadrantes: Q1 (M alto + I alto), Q2a (M baixo + I alto + alavanca), Q2b (M baixo + I alto + sem alavanca comercial), Q3 (M alto + I baixo), Q4 (ambos baixos)
- `engine/tests/test_scores.py` cobrindo: normalização em [0,100], soma de pesos, classificação por quadrante

**Todo List:**
1. Criar `engine/conecta/scores/models.py` — `ScoreWeights` Pydantic com validação `sum == 1.0`
2. Implementar `score_M`: combinar domicílios_urbanos, renda_media, penetração de fibra (1 - acessos_fibra/domicilios), market_share_vivo_movel, HHI (invertido); normalizar min-max
3. Implementar `score_I`: combinar matriculas_publicas, matriculas_rurais_pct, déficit de banda (calcular inline), escolas_sem_internet_aprendizagem, ivs; normalizar min-max
4. Implementar `score_C`: custo proxy = distância ao backhaul mais próximo × custo_km + densidade_inversa; normalizar e **inverter** (custo menor = score maior)
5. Implementar `score_A`: combinar acordo_migracao (binário), fust_elegivel (binário), eace_escolas (contagem); normalizar 0–100
6. Calcular `score_total = w_M * score_M + w_I * score_I + w_C * score_C + w_A * score_A`
7. Classificar quadrantes: eixo M ≥ mediana → "M alto"; eixo I ≥ mediana → "I alto"; Q2a = M baixo + I alto + A > 0; Q2b = M baixo + I alto + A == 0
8. Escrever testes unitários

**Relevant Context:**
- Fórmula do déficit de banda (§4.1): `max(alunos_maior_turno * 1 Mbps, 50 Mbps) - velocidade_medida_mbps`
- `score_C` é o único índice que deve ser **invertido** (custo alto → score baixo)
- Os pesos são ajustáveis pelo usuário via simulador (§8.1 Módulo 2)
- O quadrante é usado como cor no mapa do Chris: verde Q1, azul Q2a, roxo Q2b, amarelo Q3, cinza Q4

---

## Sub-Tarefa 3 — Módulo de Distâncias ao Backhaul

**Status:** `[ ] pending`

**Intent:**
Calcular a distância de cada município ao município mais próximo com backhaul de fibra, que
é o proxy de custo de backhaul usado no score_C e na ferramenta financeira.

**Expected Outcomes:**
- `engine/conecta/geo/distances.py` com função `add_backhaul_distances(municipios: pd.DataFrame, backhaul: pd.DataFrame) -> pd.DataFrame`
  - Adiciona coluna `dist_backhaul_km` usando distância geodésica (haversine) via scipy KDTree ou scikit-learn BallTree
  - Municípios que já têm backhaul recebem `dist_backhaul_km = 0.0`
- `engine/tests/test_geo.py` cobrindo: município com backhaul → distância 0; distância entre dois pontos conhecidos

**Todo List:**
1. Criar `engine/conecta/geo/distances.py`
2. Converter lat/lon para radianos e usar `scipy.spatial.cKDTree` com métrica haversine (ou `BallTree` do sklearn)
3. Para municípios já na lista de backhaul, forçar `dist_backhaul_km = 0.0`
4. Expor função `add_backhaul_distances(municipios_df, backhaul_df) -> pd.DataFrame`
5. Escrever testes

**Relevant Context:**
- Campo de entrada: `lat`, `lon` em graus decimais (WGS84)
- A Anatel não publica o traçado das rotas — distância euclidiana geodésica é o proxy aceito (§9 Riscos)
- O resultado `dist_backhaul_km` alimenta diretamente `score_C` e `financial.capex_backhaul()`

---

## Sub-Tarefa 4 — Ferramenta Financeira

**Status:** `[ ] pending`

**Intent:**
Calcular o business case de cada município com e sem cada alavanca, incluindo payback simples,
VPL e análise de sensibilidade à taxa de adesão.

**Expected Outcomes:**
- `engine/conecta/financial/models.py` — `FinancialParams` Pydantic com todos os parâmetros ajustáveis
- `engine/conecta/financial/calculator.py` — funções:
  - `capex(municipio, params) -> CapexResult` (acesso + backhaul + ativação, com e sem alavancas)
  - `payback(municipio, params, alavancas) -> float` (anos)
  - `npv(municipio, params, alavancas, wacc, anos) -> float` (VPL)
  - `sensitivity(municipio, params, alavancas) -> SensitivityTable` (payback para adesão 15/25/35%)
- `engine/tests/test_financial.py` reproduzindo os números da tabela ilustrativa do §4.3

**Todo List:**
1. Criar `engine/conecta/financial/models.py`:
   - `FinancialParams`: custo_hp (R$/casa passada), custo_backhaul_km, custo_ativacao, adesao_pct, arpu_mensal, margem_ebitda, wacc, anos_projeto
   - `Alavancas`: backhaul_comprometido (bool), fust_reembolsavel (bool), receita_escolar (bool), arpu_escolar_mensal
2. Implementar `capex()`: se `backhaul_comprometido=True`, zera CapEx de backhaul
3. Implementar `payback()`: `capex_incremental / (receita_anual * margem_ebitda)`; incluir rampa de adesão (anos 1-3 em ramp-up)
4. Implementar `npv()`: fluxo de caixa anual descontado por `wacc` por `anos_projeto` anos; usar numpy para vetorização
5. Implementar `sensitivity()`: iterar sobre `[0.15, 0.25, 0.35]` e retornar tabela de payback × adesão × cenário de alavanca
6. Escrever testes reproduzindo a simulação ilustrativa do §4.3 (payback ~10.6 / ~5.7 / ~5.0 anos)

**Relevant Context:**
- Tabela ilustrativa em §4.3 da `PROPOSTA_DETALHADA.md` serve como caso de teste
- Prêmio de receita escolar só se aplica quando `receita_escolar=True` E a modalidade permite cobrança
- VPL deve ser calculado com EBITDA descontado de impostos (simplificação: `fluxo = EBITDA × (1 - aliquota_imposto)`)
- O efeito do FUST se manifesta no VPL (diferencial de juros), não no payback simples

---

## Sub-Tarefa 5 — Ferramenta de Otimização de Portfólio

**Status:** `[ ] pending`

**Intent:**
Selecionar o subconjunto de municípios de um recorte filtrado que maximiza o score combinado
(impacto social + VPL normalizado) sob restrição de orçamento e payback máximo.

**Expected Outcomes:**
- `engine/conecta/optimizer/portfolio.py` com função `optimize_portfolio(municipios_df, params, budget, lambda_, max_payback) -> PortfolioResult`
  - Formulação binária: `max Σ x_i * [λ * Î_i + (1-λ) * VPL̂_i]` s.a. `Σ x_i * CapEx_i ≤ budget`, `payback_i ≤ max_payback ∀ selecionados`, `x_i ∈ {0,1}`
- `PortfolioResult` contém: municípios selecionados, CapEx total, payback médio, score total, status do solver
- `engine/tests/test_optimizer.py` com caso simples verificável à mão

**Todo List:**
1. Criar `engine/conecta/optimizer/portfolio.py`
2. Construir o problema PuLP: variáveis binárias `x[i]` para cada município
3. Definir função objetivo: `lpSum(x[i] * (lambda_ * norm_I[i] + (1 - lambda_) * norm_npv[i]))`
4. Adicionar restrição de orçamento: `lpSum(x[i] * capex[i]) <= budget`
5. Adicionar restrição de payback: modelar como `x[i] = 0` quando `payback[i] > max_payback` (pré-filtro antes do LP, mais simples que big-M)
6. Executar `prob.solve(PULP_CBC_CMD(msg=0))` e extrair solução
7. Retornar `PortfolioResult` com municípios selecionados e métricas agregadas
8. Escrever testes: orçamento zero → portfólio vazio; orçamento infinito → todos os elegíveis pelo payback

**Relevant Context:**
- Formulação em §5.1 Componente 5 da `PROPOSTA_DETALHADA.md`
- `λ` (lambda) é o peso impacto/retorno ajustável pelo usuário no simulador
- Normalizações de `Î` e `VPL̂` devem usar o mesmo range do recorte filtrado (não global)
- CBC é suficiente para qualquer estado (< 5570 municípios, problema pequeno)

---

## Sub-Tarefa 6 — API FastAPI

**Status:** `[ ] pending`

**Intent:**
Expor os módulos Python como endpoints HTTP RESTful, com documentação automática via OpenAPI,
para que o React (e futuramente o agente orquestrador do Joel) possam consumir.

**Expected Outcomes:**
- `engine/api/main.py` com app FastAPI, CORS para `localhost:5173`, lifespan carregando os dados mock
- Routers:
  - `GET /municipios` — lista com scores calculados (aceita query params: `uf`, `quadrante`)
  - `POST /scores` — recalcula scores com pesos customizados no body
  - `POST /financial` — calcula business case de um município com params e alavancas
  - `POST /portfolio` — otimiza portfólio com body `{budget, lambda_, max_payback, uf?, alavancas}`
  - `GET /backtest` — retorna resultado do backtest (pré-calculado)
- Documentação disponível em `/docs` (Swagger UI)
- `engine/tests/test_api.py` com cliente de teste FastAPI (TestClient)

**Todo List:**
1. Criar `engine/api/__init__.py` e `engine/api/main.py` com app FastAPI e lifespan
2. Criar `engine/api/routers/municipios.py` — `GET /municipios`
3. Criar `engine/api/routers/scores.py` — `POST /scores` chamando `calculate_scores()`
4. Criar `engine/api/routers/financial.py` — `POST /financial` chamando `capex()`, `payback()`, `npv()`, `sensitivity()`
5. Criar `engine/api/routers/portfolio.py` — `POST /portfolio` chamando `optimize_portfolio()`
6. Criar `engine/api/routers/backtest.py` — `GET /backtest` retornando resultado pré-calculado
7. Registrar CORS middleware permitindo `http://localhost:5173`
8. Escrever testes de integração com `TestClient`

**Relevant Context:**
- O lifespan deve carregar `mock_municipios.csv` e `mock_backhaul.csv` uma vez e guardar no `app.state`
- Os routers devem usar os modelos Pydantic dos módulos de domínio como request/response bodies
- A rota `/municipios` é a primeira que o React vai chamar para popular o painel de scores

---

## Sub-Tarefa 7 — Frontend React (Vite + Tailwind)

**Status:** `[ ] pending`

**Intent:**
Construir as duas telas básicas do simulador que o Rafael é responsável por entregar:
o painel de scores/quadrantes e o simulador de alavancas financeiras.

**Expected Outcomes:**
- `web/src/pages/ScoreMap.tsx` — tabela de municípios com colunas: nome, UF, M, I, C, A, total, quadrante (badge colorido); filtro por UF e quadrante
- `web/src/pages/Simulator.tsx` — formulário com: seleção de município, sliders de pesos (M/I/C/A), toggle de alavancas, campo de orçamento, botão "Otimizar"; exibe business case e portfólio resultante
- `web/src/api/client.ts` — funções tipadas: `getMunicipios()`, `postScores()`, `postFinancial()`, `postPortfolio()`
- `web/src/components/QuadrantBadge.tsx` — badge colorido por quadrante (verde Q1, azul Q2a, roxo Q2b, amarelo Q3, cinza Q4)
- App roda em `localhost:5173` e consome o backend em `localhost:8000`

**Todo List:**
1. Scaffold: `npm create vite@latest web -- --template react-ts` (se não feito na sub-tarefa 1)
2. Instalar e configurar Tailwind CSS + PostCSS
3. Criar `web/src/api/client.ts` com `BASE_URL = 'http://localhost:8000'` e `getMunicipios`, `postScores`, `postFinancial`, `postPortfolio`
4. Criar `web/src/components/QuadrantBadge.tsx`
5. Criar `web/src/pages/ScoreMap.tsx`: fetch `GET /municipios` ao montar, renderizar tabela com filtros de UF/quadrante
6. Criar `web/src/pages/Simulator.tsx`: formulário controlado, chamar `POST /financial` ao selecionar município, chamar `POST /portfolio` ao clicar "Otimizar"
7. Criar `web/src/App.tsx` com roteamento simples (dois links: Score Map | Simulador)
8. Garantir que proxy Vite encaminha `/api` → `localhost:8000` (ou configurar CORS no backend — já feito na sub-tarefa 6)

**Relevant Context:**
- Cores dos quadrantes definidas em §8.1 Módulo 1 da proposta
- O simulador é o §8.1 Módulo 2: controles de orçamento, chaves de alavancas, premissas editáveis
- Chris vai pegar essas telas e evoluir para o dashboard completo com mapa — manter componentes simples e reutilizáveis

---

## Sub-Tarefa 8 — Backtest 2021→2025

**Status:** `[ ] pending`

**Intent:**
Validar o modelo calculando os scores com dados de 2021 e verificando se os municípios
de score alto anteciparam onde a fibra realmente cresceu até 2025 (série histórica Anatel).

**Expected Outcomes:**
- `engine/conecta/backtest/runner.py` com função `run_backtest(data_2021, data_2025) -> BacktestResult`
  - Calcula scores com os dados de 2021
  - Compara os municípios Q1/Q2 de 2021 com onde houve crescimento de fibra de 2021 a 2025
  - Retorna métricas: precision (dos Q1/Q2 de 2021, quantos realmente cresceram), recall (dos que cresceram, quantos estavam em Q1/Q2)
- `engine/data/mock_backtest_2021.csv` — versão do mock com campos da série 2021 (mesmos campos, valores distintos)
- `engine/tests/test_backtest.py`

**Todo List:**
1. Criar `engine/conecta/backtest/runner.py`
2. Rodar `calculate_scores()` sobre o DataFrame de 2021
3. Definir "crescimento de fibra" como `acessos_fibra_2025 > acessos_fibra_2021 * 1.2` (crescimento > 20%)
4. Calcular precision e recall dos quadrantes Q1+Q2a como preditor de crescimento
5. Retornar `BacktestResult` com tabela de confusion matrix e métricas
6. Criar `mock_backtest_2021.csv` com os mesmos 50 municípios, valores de 2021
7. Expor resultado via `GET /backtest` (já previsto na sub-tarefa 6)
8. Escrever testes

**Relevant Context:**
- O backtest é a "principal evidência de que o modelo funciona" (§8.1 Módulo 5)
- É usado no pitch no minuto 3:30 (§8.2)
- Quando o Joel entregar a série histórica real da Anatel, trocar o mock pelos dados reais sem mudar a API
