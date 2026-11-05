# Referência técnica do motor Conecta+

## Status e autoridade

Este documento foi derivado da implementação atual em `engine/conecta/`.
O código é a referência para fórmulas e comportamento. Esta é documentação
interna do projeto, não uma norma oficial nem uma validação regulatória.
Os dados mock e as simulações são demonstrativos; não comprovam elegibilidade
ao FUST, cobertura por programa ou recomendação de investimento.

## Scores M, I, C e A

As dimensões implementadas são:

- **M — Mercado:** potencial de mercado.
- **I — Impacto educacional:** potencial de impacto educacional.
- **C — Custo:** proxy de custo de implantação, invertido para que custo menor
  resulte em score maior.
- **A — Alavancas:** alavancas financeiras e regulatórias representadas pelos
  campos do conjunto de dados do motor.

Cada subcomponente min-max é calculado no recorte recebido por
`calculate_scores`, na escala de 0 a 100. Se todos os valores de um
subcomponente forem iguais, sua normalização retorna 50. Portanto, scores são
relativos ao conjunto calculado e podem mudar quando o recorte muda.

### Mercado (M)

`score_M` combina subcomponentes normalizados:

```text
0,25 × domicílios urbanos
+ 0,20 × renda média
+ 0,20 × gap de fibra
+ 0,20 × participação móvel da Vivo
+ 0,10 × HHI invertido (10000 − HHI)
+ 0,05 × participação de PPPs invertida (1 − ppp_share)
```

O gap de fibra é `1 − acessos_fibra / max(domicilios_urbanos, 1)`, limitado
superiormente a 1 antes da normalização. O score final é limitado a 0–100.

### Impacto educacional (I)

```text
score_I =
  0,20 × matrículas públicas normalizadas
+ 0,15 × percentual de matrículas rurais normalizado
+ 0,35 × déficit de banda normalizado
+ 0,15 × escolas sem internet para aprendizagem normalizadas
+ 0,15 × IVS normalizado
```

O déficit municipal usado como proxy é:

```text
necessidade = max(alunos_maior_turno_est × 1 Mbps, 50 Mbps)
déficit = max(necessidade − velocidade_medida_mbps, 0)
```

O cálculo usa os campos agregados disponíveis no conjunto do motor; não é uma
medição por escola individual.

### Custo (C)

O código calcula um proxy com componentes min-max:

```text
custo_proxy =
  0,50 × distância ao backhaul
+ 0,30 × inverso da densidade domiciliar
+ 0,20 × elevação média
score_C = 100 − limitar(custo_proxy, 0, 100)
```

A densidade usada é `domicilios_urbanos / max(area_km2, 0,01)`. Valores
ausentes de distância ao backhaul são tratados como zero no cálculo do score.
Como há inversão, um `score_C` maior significa proxy de custo menor; não é
uma estimativa financeira de CapEx.

### Alavancas (A)

```text
score_A = limitar(
  50 × acordo_migracao
  + 30 × fust_elegivel
  + 20 × eace_escolas ÷ máximo(eace_escolas),
  0, 100
)
```

Os dois primeiros campos são convertidos em indicadores binários. A parcela de
escolas EACE é normalizada no recorte. `fust_elegivel` é apenas um campo de
entrada do conjunto demonstrativo: não representa decisão oficial nem
comprovação de elegibilidade.

### Score total e pesos

O padrão de `ScoreWeights` é peso igual de 0,25 para cada dimensão. O usuário
pode fornecer outros pesos entre 0 e 1, desde que somem 1:

```text
score_total = w_M × score_M + w_I × score_I + w_C × score_C + w_A × score_A
```

## Classificação em quadrantes

Os limites são as medianas de `score_M` e `score_I` no recorte corrente; valores
iguais à mediana contam como altos. A separação entre Q2a e Q2b usa
`score_A > 0`. Sem dados de alavanca (campos neutros no ETL), `score_A` é zero em
todos os municípios, Q2a fica vazio e os de Mercado baixo e Impacto alto aparecem em Q2b.

- **Q1:** Mercado alto e Impacto alto.
- **Q2a:** Mercado baixo, Impacto alto e Alavancas positivas.
- **Q2b:** Mercado baixo, Impacto alto e sem Alavancas.
- **Q3:** Mercado alto e Impacto baixo.
- **Q4:** Mercado baixo e Impacto baixo.

As cores e recomendações de apresentação em documentos de proposta não fazem
parte do cálculo numérico dos quadrantes.

## CapEx, payback, VPL e premissas

Os padrões definidos em `FinancialParams` são:

| Premissa | Padrão | Unidade |
|---|---:|---|
| Custo por home passed | 477,00 | R$ |
| Custo de backhaul | 61.800,00 | R$/km |
| Custo de ativação | 500,00 | R$/cliente |
| Adesão em maturidade | 0,25 | proporção |
| ARPU residencial | 87,70 | R$/mês |
| Margem EBITDA | 0,40 | proporção |
| WACC privado | 0,15 | ao ano |
| WACC usado com a alavanca FUST reembolsável | 0,0325 | ao ano |
| Horizonte | 10 | anos |
| Alíquota efetiva IR+CSLL | 0,34 | proporção |

O CapEx é apresentado em R$ milhões:

```text
clientes = domicilios_urbanos × adesao_pct
acesso = domicilios_urbanos × custo_hp
backhaul = 0 se backhaul_comprometido; caso contrário distância_km × custo_backhaul_km
ativação = clientes × custo_ativacao
CapEx total = (acesso + backhaul + ativação) / 1.000.000
```

O payback simples é `CapEx total / EBITDA anual em maturidade`, sem desconto de
impostos e sem rampa. Se o EBITDA for zero ou negativo, o resultado é infinito.

O VPL usa NOPAT anual (`EBITDA × (1 − aliquota_imposto)`), descontado por WACC
em 10 anos por padrão, menos o CapEx inicial. A rampa do NOPAT nos três
primeiros anos é 40%, 70% e 100%; os anos posteriores usam 100%. Com
`fust_reembolsavel=True`, o código troca a taxa de desconto para `wacc_fust`;
não reduz automaticamente o valor do CapEx. A receita escolar é adicionada
somente quando `receita_escolar=True`. A sensibilidade varia a adesão entre
15%, 25% e 35% por padrão e recalcula o payback.

Esses valores são premissas configuráveis de simulação, não propostas
comerciais, custos observados ou condições oficiais de financiamento.

## Otimização de portfólio

`optimize_portfolio` calcula o business case de cada município, remove
candidatos cujo payback excede o limite, e usa variáveis binárias para
maximizar:

```text
Σ xᵢ × [λ × min-max(score_I)ᵢ + (1 − λ) × min-max(VPL)ᵢ]
```

sujeito a:

```text
Σ xᵢ × CapExᵢ ≤ budget
xᵢ ∈ {0, 1}
paybackᵢ ≤ max_payback (pré-filtro)
```

`λ` varia de 0 (VPL normalizado) a 1 (Impacto normalizado); o padrão é 0,5.
Scores e VPL são normalizados no conjunto de candidatos elegíveis. Se o score
I não existir, o código usa 50. A otimização depende do solver PuLP/CBC e dos
dados e premissas recebidos.

## Limitações e fontes regulatórias

O motor opera sobre os campos presentes no CSV demonstrativo e não valida as
fontes originais nem a atualidade dos dados. Propostas e planos internos podem
descrever funcionalidades ou hipóteses que não correspondem à implementação.
O código e este resumo explicam comportamento computacional; não substituem
documentos oficiais ou análise jurídica.

O índice RAG atual contém fontes internas do projeto e código-fonte. Nenhum
documento regulatório oficial sobre FUST, ENEC ou outro programa foi
incorporado como fonte oficial; perguntas sobre elegibilidade ou interpretação
regulatória devem receber essa limitação explícita.
