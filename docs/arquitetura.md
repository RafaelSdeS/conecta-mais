# Arquitetura — Conecta+

## Visão geral

```
                  ┌─────────────────────────────────┐
                  │   USUÁRIO / ANALISTA             │
                  │   (React — Painel + Simulador)   │
                  └──────────────┬──────────────────┘
                                 │ HTTP JSON
                  ┌──────────────▼──────────────────┐
                  │   FastAPI (engine/api/)          │
                  │   POST /scores                   │
                  │   POST /financial                │
                  │   POST /portfolio                │
                  │   GET  /municipios               │
                  │   GET  /backtest                 │
                  └──┬──────┬──────┬──────┬─────────┘
                     │      │      │      │
              ┌──────▼─┐ ┌──▼───┐ ┌▼────┐ ┌▼────────┐
              │ scores │ │ geo  │ │ fin │ │optimizer│
              │ M,I,C,A│ │ dist │ │ VPL │ │ MILP    │
              └──────┬─┘ └──────┘ └─────┘ └─────────┘
                     │
              ┌──────▼──────────────────────────────┐
              │   data/ (CSVs mock → GeoParquet)     │
              │   schema Pydantic + loader           │
              └─────────────────────────────────────┘
```

## Módulos do backend

### `conecta/data/`
- **`schema.py`** — modelo Pydantic `Municipio` com todos os campos e validações (código IBGE 7 dígitos, UF válida, ranges numéricos). É o contrato entre o ETL do Joel e os módulos de cálculo.
- **`loader.py`** — `load_municipios()` e `load_backhaul()`. Valida cada linha contra o schema e falha com mensagem clara se algum campo estiver inválido ou ausente.

### `conecta/scores/`
- **`models.py`** — `ScoreWeights`: pesos w_M, w_I, w_C, w_A com validação de soma = 1.0.
- **`calculator.py`** — `calculate_scores(df, weights)`: calcula os quatro índices normalizados em [0,100] e classifica em quadrantes.
  - **score_M** (Potencial de Mercado): domicílios, renda, gap de fibra, share móvel Vivo, HHI invertido, PPP share.
  - **score_I** (Impacto Educacional): matrículas, % rurais, déficit de banda (`max(alunos×1Mbps, 50Mbps) − velocidade`), escolas sem internet, IVS.
  - **score_C** (Custo): distância ao backhaul + densidade domiciliar + elevação — **invertido** (custo menor = score maior).
  - **score_A** (Alavancas): acordo de migração (50 pts) + FUST (30 pts) + EACE (20 pts).
  - **Quadrantes**: Q1 verde / Q2a azul / Q2b laranja / Q3 amarelo / Q4 cinza.

### `conecta/geo/`
- **`distances.py`** — `add_backhaul_distances(municipios, backhaul)`: distância geodésica haversine via `cKDTree` (chord length → km). Municípios já com backhaul recebem `dist_backhaul_km = 0`.

### `conecta/financial/`
- **`models.py`** — `FinancialParams`, `Alavancas`, `CapexResult`, `FinancialResult`.
- **`calculator.py`** — `capex()`, `payback()`, `npv()`, `sensitivity()`, `business_case()`.
  - Payback simples: `CapEx / EBITDA_maturidade` (sem desconto, consistente com §4.3 da proposta).
  - VPL: NOPAT = EBITDA × (1 − alíquota), com rampa de adesão nos 3 primeiros anos, descontado por WACC ou WACC_FUST.
  - Efeito FUST: substitui WACC por WACC_FUST no cálculo do VPL (não altera o payback simples).

### `conecta/optimizer/`
- **`portfolio.py`** — `optimize_portfolio(df, params, alavancas, budget, lambda_, max_payback)`.
  - Formulação: `max Σ xᵢ·[λ·Îᵢ + (1−λ)·VPL̂ᵢ]` s.a. `Σ xᵢ·CapExᵢ ≤ budget`, `xᵢ ∈ {0,1}`.
  - Solver: PuLP + CBC (open-source). Adequado para qualquer estado (< 5.570 variáveis binárias).
  - Pré-filtro de payback antes do solver (mais simples que big-M).

### `conecta/backtest/`
- **`runner.py`** — `run_backtest(data_2021, data_2025, backhaul)`.
  - Calcula scores com dados de 2021; predição positiva = Q1 ou Q2a.
  - Crescimento real: `acessos_fibra_2025 > acessos_fibra_2021 × 1.2`.
  - Retorna precision, recall, F1 e DataFrame de detalhes por município.

## Frontend

### `web/src/`
- **`App.tsx`** — layout sidebar 208 px + main (idêntico ao mockup).
- **`components/QuadrantBadge.tsx`** — badge colorido com as cores exatas do mockup.
- **`pages/ScoreMap.tsx`** — tabela de municípios com filtros UF/quadrante/busca e ordenação.
- **`pages/Simulator.tsx`** — formulário de alavancas + premissas; exibe business case e portfólio.
- **`api/client.ts`** — helpers tipados `get`/`post` com todos os tipos de domínio.

## Fluxo de dados

```
CSV / GeoParquet
       │
       ▼
  loader.py  ──► schema Pydantic (validação)
       │
       ▼
  add_backhaul_distances()   ← geo/distances.py
       │
       ▼
  calculate_scores()         ← scores/calculator.py
       │
       ├──► business_case()  ← financial/calculator.py
       │
       ├──► optimize_portfolio() ← optimizer/portfolio.py
       │
       └──► run_backtest()   ← backtest/runner.py
```

## Decisões técnicas

| Decisão | Motivo |
|---|---|
| Normalização min-max por recorte | Scores relativos ao conjunto analisado; escala nacional quando Joel entregar os 5.570 municípios |
| Payback simples sem rampa | Consistente com tabela §4.3 da proposta; VPL usa rampa |
| Pré-filtro de payback antes do MILP | Elimina municípios inviáveis antes do solver, mais simples que big-M |
| PuLP `< 4.0` | API quebrou na v4; pino no `pyproject.toml` |
| `astype(object).where()` no loader | Converte `NaN` pandas para `None` Python antes do Pydantic |
| `df_to_records()` na API | `json.dumps` não aceita `float('nan')`; helper centraliza a limpeza |
