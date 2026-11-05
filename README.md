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
Sem o backend, o frontend (em localhost) carrega dados demonstrativos e mostra um aviso na tela.
A documentação interativa da API fica em `http://localhost:8000/docs`.

**Processo único (demonstração):** com o frontend compilado, a API entrega páginas e dados na mesma porta.

```bash
cd web && npm ci && npm run build
cd ../engine && python -m etl.run_etl
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

**IBM Granite:** copie `engine/.env.example` para `engine/.env` e preencha as credenciais do watsonx.ai.
`/chat` e `/ia/*` aceitam até 30 chamadas por minuto no total, porque cada uma consome créditos.

**No celular:** localização e compartilhamento nativo exigem HTTPS; em HTTP, a busca pelo nome e o envio pelo WhatsApp continuam funcionando.

**Solver:** o portfólio usa CBC por padrão, com limite de 3 s; `CONECTA_SOLVER=cplex` usa o IBM CPLEX, se estiver instalado e licenciado.

---

## Testes

```bash
cd engine
ruff check .
python -m pytest

cd ../web
npm run lint
npm test
npm run build
```

A CI roda os mesmos comandos em `.github/workflows/ci.yml`.

---

## Frontend — Views

| View | Descrição |
|---|---|
| **Campo** | Entrada do app para o gestor no celular: busca, "Perto de mim", prioridades da região e carteira; cada município abre o veredito e o kit da visita |
| **Painel** | KPIs animados, mapa Leaflet com todos os municípios, quadrantes, histograma de payback e explicação do portfólio por IA |
| **Municípios** | Tabela ordenável com busca, filtros, favoritos e portfólio |
| **Agente** | Chat com o IBM Granite (watsonx.ai): ranking, portfólio, comparação e dúvidas de uso |
| **Solução** | Arquitetura IBM watsonx, ROI estimado e fases de entrega |

**Atalhos:** `Ctrl+K` abre a paleta de comandos. Clique em qualquer município para abrir a ficha executiva.

---

## Arquitetura

```
web/src/
  pages/
    CampoView.tsx       ← entrada para o gestor em campo: busca, proximidade, prioridades e carteira
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
    agent/          ← agente Granite: orquestrador, ferramentas, auditoria e fidelidade dos números
    rag/            ← índice e busca na documentação e nas fontes oficiais
    mercado/        ← análise de provedores por município
    data/           ← schema Pydantic + loader CSV/Parquet
    scores/         ← cálculo de M, I, C, A e quadrantes
    geo/            ← distâncias ao backhaul (haversine)
    financial/      ← CapEx, payback, VPL, sensibilidade
    optimizer/      ← portfólio MILP (PuLP + CBC)
    backtest/       ← backtest 2021→hoje
  etl/              ← pipeline de dados (steps 1 a 12 e run_etl.py)
  data/             ← SQLite do ETL (base real) e CSVs demonstrativos de fallback
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
| `GET` | `/backtest` | Backtest 2021→hoje (lift, AUC, precision, recall) |
| `GET` | `/qualidade` | Estado de cada campo: real, aproximado ou neutro |
| `GET` | `/health` | Healthcheck e fonte dos dados |
| `GET` | `/dados/municipios`, `/dados/municipios/{codigo_ibge}` | Base integrada do ETL |
| `GET` | `/dados/escolas`, `/dados/escolas/sem-internet` | Escolas do Censo Escolar |
| `GET` | `/dados/escolas/visita` | Kit da visita: escolas sem internet para aprendizagem, com endereço e telefone |
| `GET` | `/dados/indicadores/{codigo_ibge}` | Indicadores escolares do município |
| `GET` | `/dados/provedores/{codigo_ibge}` | Provedores que atuam no município |
| `GET` | `/dados/ubs` | Unidades Básicas de Saúde |
| `POST` | `/chat` | Agente com IBM Granite e ferramentas do motor |
| `POST` | `/ia/justificativa`, `/ia/portfolio-narrativa` | Textos do Granite sobre números do motor |
| `POST` | `/ia/filtros` | Converte um pedido em linguagem natural em filtros |
| `GET` | `/ia/auditoria` | Resumo do registro das chamadas de IA |

Veja [`docs/api.md`](docs/api.md) para exemplos de request/response.

---

## Dados

A API usa a base real quando `engine/data/conecta_mais.db` (ou `CONECTA_SQLITE_PATH`) tem as
tabelas do motor; caso contrário cai nos CSVs demonstrativos de `engine/data/` e `GET /health`
informa `fonte_dados: "mock"`. Para gerar ou atualizar a base real:

```bash
cd engine
python -m etl.run_etl
```

O ETL também gera o índice de documentos do agente. Ele grava num arquivo temporário e troca no final, então uma API em execução (`--reload`) nunca encontra o banco ausente. Se a API subir sem o banco, o log avisa que está usando dados demonstrativos; depois de rodar o ETL, reinicie a API.

A base tem 5.570 municípios. Boa Esperança do Norte (MT), criado em 2023, fica de fora porque o IBGE ainda não publica a área dele.

| Campo | Fonte | Estado |
|---|---|---|
| `renda_media`, `area_km2`, `lat`/`lon` | IBGE (Censo 2022) | real |
| `domicilios_urbanos` | IBGE (Censo 2022, tabela 4712): total de domicílios ocupados, sem separar urbano e rural | real |
| `acessos_fibra`, `acessos_total_bl`, `market_share_vivo_movel`, `hhi`, `ppp_share` | Anatel — dados abertos de acessos | real |
| `tem_backhaul_fibra` | Anatel — backhaul (Base dos Dados) | real |
| `matriculas_*`, `alunos_maior_turno_est`, `escolas_sem_internet_aprendizagem`, `alunos_sem_internet` | INEP — Censo Escolar 2024 | real |
| `semiarido` | IBGE/SUDENE — delimitação do Semiárido 2022 | real |
| `ubs` | CNES — dados abertos do SUS | real |
| `ivs` | IVS por UF (IPEA) | aproximado |
| `elevacao_media_m` | SRTM 90m no centroide (OpenTopoData) | aproximado |
| `velocidade_medida_mbps` | NIC.br / Medidor Educação Conectada | neutro |
| `acordo_migracao`, `fust_elegivel`, `eace_escolas` | Acordo TCU, editais FUST, EACE | neutro |

Campos neutros têm o mesmo valor em todos os municípios e não diferenciam o ranking. Para preenchê-los,
coloque os CSVs descritos nos steps 6 e 8 em `engine/data/raw/` (`nicbr_velocidade.csv`, `acordo_migracao.csv`,
`fust_municipios.csv`, `eace_municipios.csv`), apague o cache do step correspondente (`.parquet` na mesma pasta)
e rode o ETL de novo. A tabela `data_quality` do banco registra o estado de cada campo.

---

## Limitações conhecidas

- **Uso em campo ainda não validado:** as necessidades e o veredito são hipóteses, testadas sem usuários reais. Veja [`docs/design-thinking.md`](docs/design-thinking.md).
- **Recomendações ficam no aparelho:** não há login nem compartilhamento entre usuários; a carteira é exportada em CSV. O app não funciona sem internet.
- **`domicilios_urbanos`** é o total de domicílios ocupados, sem separar urbano e rural.
- **Alavancas sem dados:** sem as listas oficiais, `score_A` é zero em todos os municípios, Q2a fica vazio e quem tem M baixo e I alto aparece em Q2b. O efeito das alavancas em payback e VPL funciona; a contagem de municípios que mudam de quadrante só aparece com as listas. Ao preenchê-las, reveja o ranking: uma alavanca binária pesa muito sobre o `score_total`.
- **Backtest é validação parcial:** a fibra é de 2021, mas os demais indicadores são atuais, e o resultado fica pouco acima do acaso (lift 1,20 e AUC 0,61 no limiar de dobrar a fibra).
- **Normalização min-max:** valores extremos, como os de São Paulo, comprimem os demais municípios, e os pesos declarados pesam menos do que parecem. Log nas séries com cauda longa foi avaliado e adiado: 31% dos municípios mudariam de quadrante, sem ganho claro no backtest.
