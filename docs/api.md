# API Reference — Conecta+

Base URL (dev): `http://localhost:8000`  
Documentação interativa: `http://localhost:8000/docs`

---

## GET `/municipios`

Lista todos os municípios com scores calculados.

**Query params:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `uf` | string | Filtrar por UF (ex: `SP`, `BA`) |
| `quadrante` | string | Filtrar por quadrante (`Q1`, `Q2a`, `Q2b`, `Q3`, `Q4`) |

**Response:** array de objetos `Municipio` com todos os campos do schema + `score_M`, `score_I`, `score_C`, `score_A`, `score_total`, `quadrante`, `dist_backhaul_km`, `deficit_banda_mbps`.

```bash
curl http://localhost:8000/municipios?uf=BA&quadrante=Q2a
```

---

## POST `/scores`

Recalcula os scores com pesos customizados para os quatro índices.

**Body:**
```json
{
  "weights": {
    "w_M": 0.4,
    "w_I": 0.3,
    "w_C": 0.2,
    "w_A": 0.1
  }
}
```

> Os pesos devem somar exatamente 1.0. Retorna 422 caso contrário.

**Response:** mesma estrutura do `GET /municipios` com scores recalculados.

---

## POST `/financial`

Calcula o business case de um município com premissas e alavancas customizáveis.

**Body:**
```json
{
  "id_municipio": "2910727",
  "params": {
    "custo_hp": 477.0,
    "custo_backhaul_km": 61800.0,
    "custo_ativacao": 500.0,
    "adesao_pct": 0.25,
    "arpu_mensal": 87.70,
    "margem_ebitda": 0.40,
    "wacc": 0.15,
    "wacc_fust": 0.0325,
    "anos_projeto": 10,
    "aliquota_imposto": 0.34
  },
  "alavancas": {
    "backhaul_comprometido": false,
    "fust_reembolsavel": true,
    "receita_escolar": false
  }
}
```

> `params` e `alavancas` são opcionais — os defaults reproduzem a simulação ilustrativa de §4.3 da proposta.

**Response:**
```json
{
  "id_municipio": "2910727",
  "capex": {
    "acesso": 2.29,
    "backhaul": 1.85,
    "ativacao": 0.60,
    "total": 4.74
  },
  "receita_anual": 1.26,
  "ebitda_anual": 0.51,
  "payback_anos": 9.3,
  "npv": -1.82,
  "sensitivity": [
    { "adesao_pct": 0.15, "payback_anos": 14.2 },
    { "adesao_pct": 0.25, "payback_anos": 9.3 },
    { "adesao_pct": 0.35, "payback_anos": 6.8 }
  ]
}
```

---

## POST `/portfolio`

Seleciona o portfólio ótimo de municípios dado um orçamento (MILP binário).

**Body:**
```json
{
  "budget": 50.0,
  "lambda_": 0.5,
  "max_payback": 8.0,
  "uf": "BA",
  "alavancas": {
    "backhaul_comprometido": false,
    "fust_reembolsavel": true,
    "receita_escolar": false
  }
}
```

| Campo | Padrão | Descrição |
|---|---|---|
| `budget` | — | Orçamento de CapEx em R$ milhões (obrigatório) |
| `lambda_` | `0.5` | Peso impacto social (1.0) vs. retorno financeiro (0.0) |
| `max_payback` | `10.0` | Payback máximo aceito (anos) |
| `uf` | nenhum | Restringe o recorte a uma UF antes de otimizar |
| `semiarido` | `false` | Só municípios do Semiárido (IBGE/SUDENE 2022) |
| `regiao` | nenhum | `Norte`, `Nordeste`, `Sudeste`, `Sul` ou `Centro-Oeste` |
| `objetivo` | `equilibrado` | `retorno` (só VPL), `equilibrado` (usa `lambda_`) ou `alunos` (maximiza alunos em escolas sem internet) |
| `params` | padrão | Premissas financeiras (ARPU, adesão, margem, WACC, custos) |

Regras das alavancas: `fust_reembolsavel` troca o WACC pelo `wacc_fust` no VPL (não altera o payback
simples); `receita_escolar` soma a receita B2G das escolas sem internet para aprendizagem;
`backhaul_comprometido` zera o CapEx de backhaul **só** dos municípios com `acordo_migracao`.

**Response:**
```json
{
  "municipios": [ ... ],
  "capex_total": 48.3,
  "payback_medio": 6.1,
  "score_total": 312.4,
  "status": "Optimal",
  "n_candidatos": 12,
  "n_selecionados": 7,
  "alunos_atendidos": 45221,
  "escolas_atendidas": 249,
  "vpl_total": -44.81,
  "efeito_alavancas": {
    "com": { "payback_medio": 6.1, "vpl_total": -10.2 },
    "sem": { "payback_medio": 6.1, "vpl_total": -40.6 }
  },
  "financeiro": [ { "id_municipio": "2927408", "capex": 1166.08, "payback": 5.72, "npv": -592.41 } ]
}
```

`efeito_alavancas` compara o mesmo conjunto de municípios com e sem as alavancas ligadas;
`financeiro` traz CapEx (R$ mi), payback e VPL (R$ mi) de todos os municípios do escopo, no cenário
pedido. O resultado de premissas e alavancas é memoizado no servidor.

---

## GET `/backtest`

Backtest 2021→hoje. Com a base real, compara a fibra de dezembro de 2021 com o último mês publicado; sem ela, usa os CSVs demonstrativos (`"fonte": "demonstrativo"`, 49 municípios).

**Response:**
```json
{
  "status": "ok",
  "fonte": "real",
  "descricao": "Fibra e banda larga fixa de pessoa física (Anatel)...",
  "precision": 0.6796,
  "recall": 0.2394,
  "f1": 0.3541,
  "total_q1_q2a_2021": 1108,
  "total_cresceram": 3146,
  "acertados": 753,
  "threshold_crescimento": 2.0,
  "taxa_base": 0.5648,
  "lift": 1.2,
  "auc": 0.612,
  "limiares": [{ "limiar": 1.2, "precision": 0.86, "recall": 0.2, "f1": 0.33, "cresceram": 4694, "taxa_base": 0.84, "lift": 1.02, "auc": 0.5525 }]
}
```

| Métrica | Interpretação |
|---|---|
| `lift` | `precision` ÷ `taxa_base`; 1,0 = o modelo não supera o acaso |
| `auc` | Chance de um município que cresceu ter `score_total` maior que um que não cresceu; 0,5 = acaso |
| `precision` | Dos municípios Q1/Q2a em 2021, quantos realmente cresceram em fibra |
| `recall` | Dos municípios que cresceram, quantos estavam em Q1/Q2a; limitado ao tamanho de Q1 enquanto Q2a estiver vazio |
| `threshold_crescimento` | Multiplicador da fibra de 2021 considerado crescimento (2,0 = dobrou) |

É uma validação parcial: os demais indicadores são atuais e podem antecipar parte do crescimento.

---

## GET `/qualidade`

Estado de cada campo do motor registrado pelo ETL:

```json
{ "fonte_dados": "real", "campos": [ { "campo": "hhi", "tipo": "neutro", "cobertura": 0.0 } ] }
```

`tipo` é `real`, `aproximado` ou `neutro` (mesmo valor para todos os municípios). O frontend usa essa lista
para desabilitar alavancas sem dados (ex.: `acordo_migracao`).

---

## GET `/health`

```json
{ "status": "ok", "fonte_dados": "real" }
```

`fonte_dados` é `real` quando o SQLite do ETL contém as tabelas do motor
(`municipios_engine` e `backhaul`) e `mock` quando a API caiu no fallback
demonstrativo (`engine/data/mock_*.csv`). O caminho do banco vem de
`CONECTA_SQLITE_PATH` (padrão `engine/data/conecta_mais.db`).

---

## Dados integrados no SQLite

As rotas abaixo consultam o banco integrado em modo somente leitura e não
alteram o banco. Configure `CONECTA_SQLITE_PATH` com o caminho do arquivo
SQLite antes de iniciar o backend principal. Se a variável não estiver
configurada, o arquivo não existir ou o esquema esperado estiver ausente, as
rotas `/dados/...` retornam HTTP 503; as rotas do engine continuam disponíveis.

As respostas identificam a origem com `fonte_dados: "sqlite_integrado"` nos
objetos de listagem e indicadores, e no cabeçalho HTTP
`X-Conecta-Fonte-Dados: sqlite_integrado` em todas as rotas.

### GET `/dados/municipios`

Parâmetros opcionais: `nome`, `uf`, `limite` (1–100, padrão 20) e `offset`
(padrão 0). `nome` aceita busca parcial.

Retorna `total`, `total_retornado`, `limite`, `offset` e a lista `municipios`.

### GET `/dados/municipios/{codigo_ibge}`

Consulta um município pelo código IBGE de sete dígitos. Retorna o registro do
banco; município inexistente retorna HTTP 404.

### GET `/dados/escolas`

Parâmetros opcionais: `codigo_municipio` (sete dígitos), `codigo_escola`
(oito dígitos), `limite` (1–100, padrão 20) e `offset` (padrão 0).
Retorna `total`, `total_retornado`, `limite`, `offset` e a lista `escolas`,
incluindo o status de validação geográfica quando disponível.

### GET `/dados/indicadores/{codigo_ibge}`

Consulta os indicadores agregados disponíveis para o código IBGE de sete
dígitos e as contagens de validação geográfica das escolas. Município
inexistente retorna HTTP 404. Os indicadores refletem apenas colunas presentes
no SQLite; a rota não calcula nem infere campos do motor de scores.

### GET `/dados/escolas/sem-internet`

Parâmetros: `codigo_municipio` (obrigatório, sete dígitos), `limite` (1–100,
padrão 50) e `offset` (padrão 0). O critério segue `INEP: IN_INTERNET = 0`.
Retorna o total e a página de escolas correspondentes.

Exemplo de configuração e inicialização (Linux/macOS):

```bash
cd engine
export CONECTA_SQLITE_PATH="/caminho/para/conecta_mais.db"
uvicorn api.main:app --reload
```

---

## POST `/chat`

Envia uma pergunta ao IBM Granite. As credenciais permanecem exclusivamente no
backend. Configure `WATSONX_APIKEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL` e
`WATSONX_MODEL_ID` no ambiente do processo. `WATSONX_MAX_TOKENS` controla o
orçamento de saída, com padrão `1024` e faixa permitida de `1` a `8192`.
O modelo esperado é
`ibm/granite-4-h-small`; o ID efetivo é o valor configurado em
`WATSONX_MODEL_ID`. A URL deve usar HTTPS.

Para desenvolvimento neste workspace, carregue o `.env` privado do mini-projeto
diretamente, sem copiá-lo ou modificá-lo. O caminho da base é relativo ao
diretório `engine`:

```bash
cd engine
export CONECTA_SQLITE_PATH=../conecta-mais-chris/data/database/conecta_mais.db
.venv/bin/uvicorn api.main:app --reload \
  --env-file ../conecta-mais-chris/.env
```

`uvicorn[standard]` fornece o suporte a `--env-file` via `python-dotenv`.
Alternativamente, copie `engine/.env.example` para `engine/.env`, substitua os
valores fictícios localmente e inicie com `--env-file .env`. Arquivos `.env` e
bancos SQLite são ignorados pelo Git. Nunca coloque credenciais no frontend.

**Request:**

```json
{
  "message": "Quantas escolas estão sem internet em Porto Alegre?",
  "history": [
    { "role": "user", "content": "Pergunta anterior" },
    { "role": "assistant", "content": "Resposta anterior" }
  ]
}
```

`context` é opcional e descreve a tela do usuário (`pagina`, `municipio_id`,
`municipio_nome`, `orcamento_mi`, `quadrante`, `busca`, `uf`, `objetivo`) e o cenário ativo
(`alavancas` e `premissas`, mesmos campos de `/portfolio`); as ferramentas de ranking, portfólio,
comparação e análise financeira calculam com esse cenário. Entra no prompt como dado, nunca como instrução.

`ranking_municipios` aceita `uf`, `somente_semiarido`, `regiao`, `max_payback` e os critérios
`score_*`, `payback`, `vpl`, `escolas_sem_internet_aprendizagem` e `alunos_por_capex`; quando nenhum município
atende ao teto de payback, a resposta traz `avisos` e `elegiveis_payback: 0`.

Ferramentas do agente: busca e indicadores de escolas (SQLite), scores e business
case de um município, `ranking_municipios`, `otimizar_portfolio`,
`comparar_municipios`, `consultar_qualidade_dados` e consulta à documentação (RAG).
Quando as ferramentas terminam, o Granite redige a resposta final; o texto
determinístico só é usado se essa chamada falhar. As fontes retornadas em
`data_sources` são `sqlite_integrado`, `engine` (motor sobre a base real),
`engine_mock` (demonstrativo) e `rag_tecnico`.

`message` é obrigatório (1–4.000 caracteres). `history` é opcional e aceita até
12 mensagens `user`/`assistant`; instruções de sistema e mensagens de ferramenta
não podem ser enviadas pelo cliente.

O cliente usa `POST /ml/v1/text/chat?version=2024-10-08`. `max_tokens`,
`time_limit`, `tools` e `tool_choice_option` são enviados no nível superior do
payload. Chamadas de ferramenta preservam a mensagem do assistente com
`tool_calls` e respondem usando `tool_call_id`; respostas incompletas ou com
`finish_reason` incompatível com as chamadas são rejeitadas. O timeout de
inferência é 30 segundos, com timeout HTTP de 90 segundos para chat e 30
segundos para IAM. Respostas encerradas por limite de tokens permanecem
incompletas; o backend registra apenas o motivo de encerramento e o orçamento,
sem registrar prompts ou conteúdo gerado.

Erros IBM são classificados sem incluir o corpo da resposta upstream: falhas de
autenticação IAM, permissão negada, requisição inválida, modelo indisponível,
timeout e indisponibilidade temporária têm códigos distintos. Um HTTP 400 da
API de chat é tratado como requisição inválida; um HTTP 400 do endpoint IAM é
tratado como credencial rejeitada.

**Response:**

```json
{
  "response": "A base integrada registra ...",
  "history": [
    { "role": "user", "content": "Quantas escolas estão sem internet em Porto Alegre?" },
    { "role": "assistant", "content": "A base integrada registra ..." }
  ],
  "data_sources": [
    {
      "id": "sqlite_integrado",
      "tipo": "real",
      "descricao": "Dados integrados do SQLite (IBGE, INEP, Anatel e NIC.br)."
    }
  ],
  "tools_executed": [
    { "name": "consultar_indicadores_escolares", "status": "success" }
  ],
  "has_demo_data": false,
  "references": [],
  "numeros_nao_confirmados": [],
  "error": null
}
```

`data_sources` distingue `sqlite_integrado` (real) de `engine_mock`
(demonstrativo). `tools_executed` não contém argumentos. Falhas do provedor
retornam o mesmo formato com `error` preenchido e status HTTP apropriado;
credenciais, tokens e respostas brutas do provedor não são incluídos.
`references` contém as referências documentais utilizadas, quando disponíveis.
Cada referência inclui `title`, `source_path`, `section`, `line_start`,
`line_end`, `document_type` e `is_official`. As fontes internas atuais são
identificadas como não oficiais.

### Recuperação de documentação local

O chat disponibiliza a ferramenta `consultar_documentacao_conecta` para
conceitos, pesos, fórmulas, quadrantes, CapEx, payback, VPL, otimização e
limitações do projeto. Ela pesquisa um índice SQLite FTS5/BM25 persistente e
retorna trechos com título, caminho relativo, seção e linhas de origem. O
resultado identifica `rag_tecnico` como documentação (`documental`), separada
dos dados reais do SQLite e dos resultados demonstrativos do engine.

O índice não é reconstruído durante uma requisição de chat. Atualize-o
explicitamente após mudanças em documentos ou código:

```bash
cd engine
.venv/bin/python -m conecta.rag.indexer
```

O índice padrão é `engine/data/rag_index.sqlite`, ignorado pelo Git. Para usar
outro caminho, defina `CONECTA_RAG_INDEX_PATH` no processo do backend e passe o
mesmo caminho com `--index` ao comando de indexação. Se o índice não existir,
a ferramenta retorna um erro explícito; se não houver correspondência, informa
que a documentação indexada não contém trechos relevantes.

As fontes atualmente indexadas são documentação interna do projeto, a
referência técnica derivada do código e os módulos de cálculo. Nenhuma delas
é marcada como norma oficial. A proposta detalhada pode conter hipóteses ou
informações regulatórias que não foram verificadas; não use seus trechos para
afirmar elegibilidade ao FUST ou interpretar normas. Documentos oficiais só
devem ser adicionados ao catálogo depois de sua origem e versão serem
verificadas. Conteúdo recuperado é tratado pelo agente como dado não confiável,
nunca como instruções.

---

## Endpoints de IA (`/ia`)

Usam o IBM Granite sem ferramentas, sobre números já calculados pelo motor.
Erros do watsonx.ai retornam o status e a mensagem pública em `detail`.
`/chat` e `/ia/*` compartilham um limite de 30 chamadas por minuto; acima dele, a API responde 429.

### POST `/ia/justificativa`

```json
{ "id_municipio": "2927408" }
```

Resposta: `{ "texto": "...", "numeros_nao_confirmados": [], "fonte_dados": "real" }`. O texto é cacheado
por município enquanto a API estiver no ar.

`numeros_nao_confirmados` traz os números do texto que não foram localizados nos dados entregues ao modelo,
considerando arredondamento e escala. É um alerta para revisão: compara valores, não o significado deles.

### POST `/ia/portfolio-narrativa`

```json
{ "ids": ["2922607", "2916708"], "orcamento_mi": 100 }
```

Explica o portfólio (composição, CapEx, payback e trade-off impacto × retorno).
Os números são recalculados no servidor a partir dos ids. A resposta também traz `numeros_nao_confirmados`.

### POST `/ia/filtros`

```json
{ "texto": "municípios do Ceará no quadrante Q1" }
```

Resposta: `{ "uf": "CE", "quadrante": "Q1", "busca": null, "apenas_portfolio": false }`.
Se o modelo não devolver um JSON válido, a API responde 422 e nada é aplicado.

### Auditoria

Cada chamada de `/chat` e `/ia/*` acrescenta uma linha JSON (data, endpoint, modelo,
latência, ferramentas, fontes) em `engine/data/auditoria_ia.jsonl`, ou no caminho de
`CONECTA_AUDIT_LOG`, com a quantidade de números não confirmados. O texto das perguntas não é gravado.
`GET /ia/auditoria` resume esse registro, e a aba Solução o exibe.
