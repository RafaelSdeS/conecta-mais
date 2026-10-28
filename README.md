# Conecta+ — Motor de Decisão

Sistema de apoio à decisão para expansão de conectividade da Vivo, desenvolvido para o **Desafio IBM SkillsBuild & Fundação Telefônica Vivo**.

> Responsabilidade: **Rafael** — scores, financeiro e otimização.
> Veja [`TEAM.md`](TEAM.md) para a divisão completa de trabalho.

---

## Estrutura do monorepo

```
conecta+/
  engine/          ← backend Python (FastAPI)
  web/             ← frontend React (Vite + Tailwind)
  docs/            ← documentação técnica
  PROPOSTA_DETALHADA.md
  TEAM.md
  rafael-plan.md
```

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Python | 3.11 |
| Node.js | 18 |
| npm | 9 |

---

## Instalação

```bash
# Backend
cd engine
pip install -e ".[dev]"

# Frontend
cd ../web
npm install
```

---

## Rodar localmente

Abra dois terminais a partir da raiz do projeto:

**Terminal 1 — API (porta 8000):**
```bash
cd engine
uvicorn api.main:app --reload
```

**Terminal 2 — Frontend (porta 5173):**
```bash
cd web
npm run dev
```

Acesse `http://localhost:5173`. A documentação interativa da API fica em `http://localhost:8000/docs`.

---

## Testes

```bash
cd engine
python -m pytest
```

77 testes, todos passando.

---

## Arquitetura

```
web/src/pages/
  ScoreMap.tsx      ← painel de scores com filtros e badges de quadrante
  Simulator.tsx     ← business case, sensibilidade e portfólio otimizado

engine/
  api/              ← FastAPI (routers por domínio)
  conecta/
    data/           ← schema Pydantic + loader CSV/Parquet
    scores/         ← cálculo de M, I, C, A e quadrantes
    geo/            ← distâncias ao backhaul (haversine)
    financial/      ← CapEx, payback, VPL, sensibilidade
    optimizer/      ← portfólio MILP (PuLP + CBC)
    backtest/       ← backtest 2021→2025
  data/             ← dados mock (substituídos pelo ETL do Joel)
  tests/            ← 77 testes pytest
```

Veja [`docs/arquitetura.md`](docs/arquitetura.md) para detalhes.

---

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/municipios` | Lista com scores calculados; filtros `?uf=` e `?quadrante=` |
| `POST` | `/scores` | Recalcula scores com pesos customizados |
| `POST` | `/financial` | Business case de um município (CapEx, payback, VPL) |
| `POST` | `/portfolio` | Portfólio ótimo sob restrição de orçamento (MILP) |
| `GET` | `/backtest` | Resultado do backtest 2021→2025 (precision, recall, F1) |
| `GET` | `/health` | Healthcheck |

Veja [`docs/api.md`](docs/api.md) para exemplos de request/response.

---

## Dados mock

Os CSVs em `engine/data/` simulam a base real que o Joel entregará via ETL. Os campos seguem exatamente as fontes da proposta:

| Campo | Fonte real |
|---|---|
| `acessos_fibra`, `ppp_share`, `hhi` | Anatel — `br_anatel_banda_larga_fixa` |
| `tem_backhaul_fibra` | Anatel — CSV "Infraestrutura: Backhaul em municípios" |
| `domicilios_urbanos`, `renda_media`, `area_km2` | IBGE Censo 2022 (SIDRA tabela 1301) |
| `matriculas_publicas`, `escolas_sem_internet_aprendizagem` | INEP — Censo Escolar |
| `velocidade_medida_mbps` | Medidor Educação Conectada (NIC.br/MEC) |
| `ivs` | IPEA — Atlas da Vulnerabilidade Social |
| `elevacao_media_m` | SRTM 90m |
| `acordo_migracao`, `fust_elegivel`, `eace_escolas` | Acordo TCU, editais FUST, EACE |

Para substituir pelos dados reais: trocar os CSVs por GeoParquet no [`engine/conecta/data/loader.py`](engine/conecta/data/loader.py). O schema Pydantic valida na inicialização.
