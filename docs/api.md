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
| `incluir` | `[]` | Até 5 códigos IBGE forçados no portfólio. Usado pela ficha em "O que mudaria para incluir?": o painel compara o resultado com o portfólio atual. Se o CapEx forçado passar do orçamento, `status` vem `Infeasible` e o portfólio vem vazio |

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

Retorna o resultado do backtest 2021→2025.

**Response:**
```json
{
  "status": "ok",
  "precision": 0.72,
  "recall": 0.65,
  "f1": 0.68,
  "total_q1_q2a_2021": 25,
  "total_cresceram": 28,
  "acertados": 18,
  "threshold_crescimento": 1.2
}
```

| Métrica | Interpretação |
|---|---|
| `precision` | Dos municípios Q1/Q2a em 2021, quantos realmente cresceram em fibra até 2025 |
| `recall` | Dos municípios que cresceram, quantos estavam em Q1/Q2a |
| `threshold_crescimento` | Crescimento mínimo considerado (1.2 = +20% de acessos de fibra) |

---

## GET `/backtest` — rótulo da fonte

A resposta inclui `"fonte": "demonstrativo"`: o backtest roda sobre CSVs demonstrativos (49 municípios), porque não há histórico de 2021 em fonte aberta.

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
`municipio_nome`, `orcamento_mi`, `quadrante`, `busca`, `uf`, `regiao`, `semiarido`, `objetivo`) e o cenário ativo
(`alavancas` e `premissas`, mesmos campos de `/portfolio`); as ferramentas de ranking, portfólio,
comparação e análise financeira calculam com esse cenário. Entra no prompt como dado, nunca como instrução.

`ranking_municipios` aceita `uf`, `somente_semiarido`, `regiao`, `max_payback` e os critérios
`score_*`, `payback`, `vpl`, `escolas_sem_internet_aprendizagem` e `alunos_por_capex`; quando nenhum município
atende ao teto de payback, a resposta traz `avisos` e `elegiveis_payback: 0`.

Ferramentas do agente: busca e indicadores de escolas (SQLite), scores e business
case de um município, `ranking_municipios`, `otimizar_portfolio`, `orcamento_minimo_para_meta`,
`comparar_municipios`, `consultar_qualidade_dados` e consulta à documentação (RAG).

`otimizar_portfolio` e `orcamento_minimo_para_meta` aceitam `alavancas` (`tcu`, `fust`, `enec`) para
simular um cenário diferente do da tela. `orcamento_minimo_para_meta` recebe `meta_alunos` e o escopo e
procura, nos degraus de R$ 5 mi do painel (até R$ 500 mi), o menor orçamento cujo portfólio com objetivo
Alunos atende a meta. Quando o painel consegue reproduzir o cenário calculado (peso 0,5, teto de 10 anos,
orçamento de R$ 5 a 500 mi), a resposta traz `acoes`, com até 3 botões "Aplicar no painel":

```json
{
  "tipo": "aplicar_cenario",
  "rotulo": "R$ 120 mi · BA · Semiárido · objetivo Alunos · sem alavancas",
  "orcamento_mi": 120, "objetivo": "alunos", "uf": "BA", "regiao": "", "semiarido": true,
  "alavancas": { "backhaul_comprometido": false, "fust_reembolsavel": false, "receita_escolar": false }
}
```

As ações são montadas pelo servidor a partir do resultado do motor, nunca do texto do modelo. Campos
`null` mantêm o que está na tela; `""` em `uf` ou `regiao` limpa o filtro.
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

## Decisões do gestor (`/decisoes`)

Registro de decisões por município. Só inclusão: nada é apagado e a decisão mais recente é a
vigente. Fica num SQLite próprio, `engine/data/decisoes.db` (ou `CONECTA_DECISOES_PATH`), separado
da base do ETL. Não há login no MVP: `responsavel` é informado pelo gestor.

### POST `/decisoes`

```json
{
  "id_municipio": "2927408",
  "decisao": "aprovar",
  "motivo": "Prefeitura cede postes; demanda confirmada com a secretaria.",
  "observacao_campo": "Visita em 04/11: obra de backhaul já iniciada.",
  "responsavel": "Gestora Regional Nordeste",
  "cenario": {
    "orcamento_mi": 80,
    "objetivo": "equilibrado",
    "escopo": { "uf": "BA", "semiarido": true },
    "params": {},
    "alavancas": { "fust_reembolsavel": true }
  },
  "situacao_no_plano": "Ficou fora: custa R$ 12,40 mi e sobram R$ 3,10 mi no orçamento.",
  "justificativa_ia": "..."
}
```

| Campo | Regra |
|---|---|
| `decisao` | `aprovar`, `adiar` ou `descartar` |
| `motivo` | obrigatório, 10 a 2.000 caracteres (espaços nas pontas não contam) |
| `observacao_campo` | opcional, até 2.000 caracteres |
| `responsavel` | obrigatório, 2 a 100 caracteres |
| `cenario` | orçamento, objetivo, escopo, premissas e alavancas da tela |
| `situacao_no_plano`, `justificativa_ia` | opcionais, textos da ficha no momento da decisão |

Resposta `201` com o registro salvo, incluindo `id`, `criado_em` (UTC), `fonte_dados` e `numeros`
(`capex_mi`, `payback_anos`, `vpl_mi`, `quadrante`, `score_total`). Os números são **recalculados
no servidor** com o cenário enviado; valores numéricos vindos do cliente são ignorados.
Município inexistente → `404`; campos inválidos → `422`.

### GET `/decisoes`

Sem parâmetros: a decisão vigente de cada município. Com `?id_municipio=2927408`: o histórico
do município, da mais recente para a mais antiga.

---

## Endpoints de IA (`/ia`)

Usam o IBM Granite sem ferramentas, sobre números já calculados pelo motor.
Erros do watsonx.ai retornam o status e a mensagem pública em `detail`.

O `cenario` de `/ia/justificativa` e o corpo de `/ia/achados` têm o mesmo formato do cenário de
`POST /decisoes`: `orcamento_mi`, `objetivo`, `escopo` (`uf`, `regiao`, `semiarido`), `params` e `alavancas`.

### POST `/ia/justificativa`

```json
{
  "id_municipio": "2918407",
  "cenario": {
    "orcamento_mi": 150, "objetivo": "equilibrado",
    "escopo": { "uf": "BA", "semiarido": true },
    "params": {}, "alavancas": {}
  }
}
```

Resposta: `{ "texto": "...", "fonte_dados": "real" }`. É uma justificativa geral, para qualquer leitor:
se o município entrou no plano e por quê, o que mudaria isso e os pontos de atenção. O servidor calcula a
situação no plano com o cenário (mesma regra da ficha) e, se o município ficou fora, simula a inclusão:
quem sairia do plano e a variação de alunos, VPL e CapEx. Sem `cenario`, usa R$ 30 mi e objetivo
Equilíbrio. O texto é cacheado por município e cenário enquanto a API estiver no ar.

### POST `/ia/portfolio-narrativa`

```json
{ "ids": ["2922607", "2916708"], "orcamento_mi": 100, "params": {}, "alavancas": {} }
```

Explica o portfólio (composição, CapEx, payback e trade-off impacto × retorno).
Os números são recalculados no servidor a partir dos ids, com `params` e `alavancas` do cenário.

### POST `/ia/filtros`

```json
{ "texto": "municípios do Ceará no quadrante Q1" }
```

Resposta: `{ "uf": "CE", "quadrante": "Q1", "busca": null, "apenas_portfolio": false }`.
Se o modelo não devolver um JSON válido, a API responde 422 e nada é aplicado.

### POST `/ia/achados`

```json
{ "orcamento_mi": 150, "objetivo": "equilibrado", "escopo": { "uf": "BA", "semiarido": true } }
```

O motor procura no cenário o que pode ter passado despercebido:

- `mais_orcamento`: quem entra e quanto mudam alunos e VPL com cerca de 20% a mais de orçamento.
- `alavanca_tcu`, `alavanca_fust`, `alavanca_enec`: para cada alavanca desligada, quantos municípios passam a
  caber no teto de payback e quanto o VPL do plano atual muda.
- `alunos_por_real_fora`: municípios fora do plano, dentro do teto, com mais alunos sem internet por R$ mi.
- `decisoes_divergentes`: aprovações registradas fora do plano atual ou descartes dentro dele.

O Granite escolhe até 3 e redige título e texto. Resposta:

```json
{
  "cartoes": [
    { "id": "mais_orcamento", "titulo": "...", "texto": "...",
      "acao": { "tipo": "aplicar_cenario", "rotulo": "Usar R$ 180 mi", "orcamento_mi": 180 } }
  ],
  "fonte_dados": "real"
}
```

Cada `acao` (aplicar um cenário ou abrir uma ficha) é ligada ao achado pelo servidor, nunca pelo modelo.
Sem achados, devolve `cartoes: []` sem chamar o Granite; se o modelo não devolver JSON válido, responde 422.

### Auditoria

Cada chamada de `/chat` e `/ia/*` acrescenta uma linha JSON (data, endpoint, modelo,
latência, ferramentas, fontes) em `engine/data/auditoria_ia.jsonl`, ou no caminho de
`CONECTA_AUDIT_LOG`. O texto das perguntas não é gravado.
