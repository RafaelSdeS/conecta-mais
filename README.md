# Conecta+ — Painel de Expansão de Conectividade

Sistema de apoio à decisão para expansão de conectividade da Vivo, desenvolvido para o **Desafio IBM SkillsBuild & Fundação Telefônica Vivo**.

> Veja [`TEAM.md`](TEAM.md) para a divisão de trabalho entre Rafael, Joel e Chris.

---

## Estrutura do monorepo

```
conecta+/
  engine/          ← backend Python (FastAPI + PuLP)
  web/             ← frontend React (Vite + Tailwind + Leaflet)
  docs/            ← documentação técnica e planos de implementação
  SVG/             ← logos oficiais do projeto
  TEAM.md
  PROPOSTA_CONECTA.pdf
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

Acesse `http://localhost:5173`.  
O frontend funciona **sem o backend** — dados mock são carregados automaticamente como fallback.  
A documentação interativa da API fica em `http://localhost:8000/docs`.

---

## Testes

```bash
cd engine
python -m pytest
```

---

## Frontend — Views

| View | Descrição |
|---|---|
| **Painel** | KPIs animados, mapa Leaflet com 417 municípios, quadrantes e histograma de payback |
| **Municípios** | Tabela ordenável com busca, filtros, favoritos e portfólio |
| **Agente** | Chat com agente de IA simulado (substituível por watsonx.ai Granite) |
| **Solução** | Arquitetura IBM watsonx, ROI estimado e fases de entrega |

**Atalhos:** `Ctrl+K` abre a paleta de comandos. Clique em qualquer município para abrir a ficha executiva.

---

## Arquitetura

```
web/src/
  pages/
    PanelView.tsx       ← painel principal: KPIs, mapa, quadrantes, histograma
    MunView.tsx         ← tabela de municípios com filtros completos
    ChatView.tsx        ← interface de chat com agente IA
    SolutionView.tsx    ← arquitetura, ROI e fases de entrega
  components/
    MapContainer.tsx    ← Leaflet + OSM (sem chave de API)
    Drawer.tsx          ← ficha executiva por município
    Header.tsx          ← slider de orçamento + alavancas
    CommandPalette.tsx  ← paleta Ctrl+K
  store/
    appStore.ts         ← estado global (Zustand)

engine/
  api/              ← FastAPI (routers por domínio)
  conecta/
    data/           ← schema Pydantic + loader CSV/Parquet
    scores/         ← cálculo de M, I, C, A e quadrantes
    geo/            ← distâncias ao backhaul (haversine)
    financial/      ← CapEx, payback, VPL, sensibilidade
    optimizer/      ← portfólio MILP (PuLP + CBC)
    backtest/       ← backtest 2021→2025
  data/             ← dados mock (CSV com ~50 municípios reais)
  tests/            ← pytest
```

Veja [`docs/arquitetura.md`](docs/arquitetura.md) para detalhes completos.

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

Os CSVs em `engine/data/` simulam a base real. Os campos seguem as fontes da proposta:

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

Para substituir pelos dados reais: trocar os CSVs por GeoParquet no [`engine/conecta/data/loader.py`](engine/conecta/data/loader.py).
