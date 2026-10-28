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

**Response:**
```json
{
  "municipios": [ ... ],
  "capex_total": 48.3,
  "payback_medio": 6.1,
  "score_total": 312.4,
  "status": "Optimal",
  "n_candidatos": 12,
  "n_selecionados": 7
}
```

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

## GET `/health`

```json
{ "status": "ok" }
```
