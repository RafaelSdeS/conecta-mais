# Conecta+ — Sistema Multiagente de Expansão Inteligente de Conectividade
**Proposta Técnica e de Negócios | Desafio IBM SkillsBuild & Fundação Telefônica Vivo**

---

## 1. Sumário Executivo

### 1.1 Em Uma Frase
> O Conecta+ é um sistema de apoio à decisão, orquestrado por agentes de IA, que ajuda a Vivo e a Fundação Telefônica Vivo a priorizar onde expandir conectividade. Ele integra potencial de mercado, impacto educacional, custo estimado de implantação e alavancas públicas e regulatórias (FUST, compromissos do acordo de migração da concessão e programas de conectividade escolar) em recomendações explicáveis e auditáveis.

### 1.2 A Tese Central
Decisões de expansão de rede costumam ser avaliadas pelo retorno privado (VPL/TIR) de cada município isoladamente. Com isso, municípios de retorno marginal ficam fora do plano, mesmo quando existem recursos públicos, obrigações regulatórias e programas escolares atuando na mesma região. Esses instrumentos raramente são analisados em conjunto com o plano comercial da operadora.

O **Conecta+** propõe a **"Expansão com Alavancas"**, ou seja, avaliar cada município considerando todos os instrumentos disponíveis:
- **Backhaul já comprometido:** o acordo de migração da concessão prevê backhaul de fibra em 121 municípios ao longo de dez anos. Trata-se de CapEx obrigatório da própria Vivo. Na decisão incremental de levar FTTH a esses municípios, esse custo deixa de pesar contra o projeto.
- **FUST:** linhas reembolsáveis, não reembolsáveis e a modalidade FUST Direto, que podem reduzir o custo de capital ou financiar a conexão de escolas.
- **Escolas públicas:** potenciais clientes institucionais, conforme a modalidade de financiamento de cada programa (PIEC, EACE/Aprender Conectado, FUST).
- **Convergência:** a rede de fibra atende os domicílios vizinhos e aproveita a base móvel da Vivo com a oferta convergente *Vivo Total*.
- **Fundação Telefônica Vivo:** direciona a formação docente para as regiões que recebem infraestrutura, para que a conectividade se traduza em uso pedagógico.

---

## 2. Contexto de Mercado e Oportunidade

### 2.1 A Vivo e a Expansão de Fibra
- **Cobertura atual:** a Vivo encerrou 2025 com 31,0 milhões de casas passadas com FTTH e 7,8 milhões de casas conectadas. A cobertura chega a 453 cidades, cerca de 8% dos 5.570 municípios do país.
- **Concorrência:** o mercado de banda larga fixa é fragmentado. Em junho de 2025, as prestadoras de pequeno porte (PPPs) detinham 56,5% dos acessos. Na fibra, a Vivo tinha 19,3% de participação ao fim de 2025.
- **Disciplina de CapEx:** a Vivo investiu R$ 9,27 bilhões em 2025, o equivalente a 15,6% da receita. A empresa declara foco em reduzir a intensidade de CapEx. Escolher bem cada município faz diferença direta nesse indicador.
- **Controle da expansão:** a Vivo assumiu 100% da FiBrasil em 2026. A FiBrasil tem rede em 151 cidades de 22 estados, com 4,6 milhões de casas passadas, e foi criada para levar a fibra da Vivo a cidades fora das capitais.
- **Convergência:** o ARPU de fibra é de R$ 87,7 (1T26) e o churn de fibra chegou a 1,4% (4T25), o menor da história da empresa. O *Vivo Total* representa 43,2% da base FTTH.

### 2.2 Onde o Mercado Sozinho Não Chega
- **Exclusão digital (TIC Domicílios 2025):** 28 milhões de brasileiros não usam internet, e 14% dos domicílios não têm acesso.
- **Falha de oferta:** entre os domicílios rurais sem internet, 28% apontam a falta de disponibilidade do serviço na região como um dos motivos, contra 13% nos urbanos (resposta múltipla).

### 2.3 Conectividade Escolar: o Gargalo é a Qualidade
- **Parâmetro oficial:** a ENEC define 1 Mbps por aluno no maior turno, com mínimo de 50 Mbps por escola.
- **Situação medida:** os números variam conforme a fonte e o método.
  - O balanço do governo federal informa 99 mil escolas públicas com internet de qualidade para uso pedagógico, de um universo de cerca de 138 mil.
  - O NIC.br, com dados do Medidor Educação Conectada (2023), encontrou apenas 11% das escolas monitoradas com mais de 50 alunos no maior turno atendendo ao parâmetro. A média nacional era de 0,26 Mbps por aluno.
- **Implicação:** a qualidade da conexão escolar é heterogênea e mal observada. Medir e cruzar essas fontes por escola é parte do valor do Conecta+.

### 2.4 Fundos e Instrumentos Disponíveis

1. **FUST (operado pelo BNDES):**
   - O Plano de Aplicação 2025–2027 autoriza repasse de até R$ 1,25 bilhão ao BNDES em 2025, entre recursos reembolsáveis e não reembolsáveis. O orçamento de 2025 previu R$ 1,029 bilhão em reembolsáveis e garantias e R$ 52 milhões em não reembolsáveis.
   - **FUST Direto:** as operadoras podem usar até 50% de sua contribuição ao fundo em 2025 e 2026 para conectar escolas. A Vivo foi a operadora que mais utilizou esse benefício.
   - **Edital não reembolsável:** R$ 53 milhões para conectar mais de 1,2 mil escolas no Norte e Nordeste (PA, MA, CE, PE e BA).
2. **Estratégia Nacional de Escolas Conectadas (ENEC):** investimento previsto de R$ 8,8 bilhões, sendo R$ 6,5 bilhões do Novo PAC. Os R$ 2,3 bilhões restantes vêm da Lei 14.172/2021 (R$ 1,7 bi), do PIEC (R$ 350 mi) e do FNDCT (R$ 250 mi).
3. **Acordo de migração da concessão da Vivo (Anatel, MCom e TCU):**
   - **Valor e escopo:** R$ 4,5 bilhões em compromissos, incluindo backhaul de fibra em 121 municípios, redes móveis em 649 localidades e manutenção da telefonia fixa sem concorrência até 2028.
   - **Cronograma:** o backhaul é implantado em dez anos, 10% a cada ano.
   - **Condições do TCU:** exigiu comprovar VPL negativo em cada município beneficiado, com substituição dos que não atenderem, e mais investimento no Norte. A lista utilizada pelo Conecta+ deve ser a versão oficial final.
4. **EACE / Aprender Conectado (recursos do leilão 5G):** R$ 3,1 bilhões, com meta de cerca de 40 mil escolas até o fim de 2026. Em dezembro de 2025, havia 14 mil escolas atendidas, a maioria por fibra óptica (9.209).

---

## 3. Proposta de Valor por Stakeholder

As métricas abaixo são **KPIs propostos para o piloto**, a serem medidos e validados com as áreas envolvidas.

| Stakeholder | Desafio | O que o Conecta+ entrega | KPI proposto |
|---|---|---|---|
| **Analista de Expansão (Vivo)** | Cruzar concorrência, demografia, educação e infraestrutura para cada município. | Ranqueamento multicritério e simulação de portfólio com payback e VPL por cenário. | Tempo médio de análise por município (antes × depois). |
| **CFO & Comitê de CapEx** | Reduzir a intensidade de CapEx sem perder crescimento. | Priorização que considera custo de capital, alavancas e sensibilidade das premissas. | Retorno previsto × realizado dos municípios priorizados. |
| **Relações Regulatórias** | Cumprir o acordo de migração e extrair valor comercial dessas obras. | Identificação dos municípios do acordo com maior potencial de FTTH no entorno do backhaul. | Receita FTTH incremental nos municípios do acordo. |
| **Fundação Telefônica Vivo** | Conectar a formação docente à chegada de infraestrutura. | Lista de escolas e municípios recém-conectados com déficit pedagógico. | Professores formados em escolas com conectividade adequada. |
| **Conselho & ESG** | Reportar impacto social ligado ao negócio principal. | Fichas por município com metodologia e fontes rastreáveis. | Alunos em escolas que passam a atender o parâmetro da ENEC. |

---

## 4. O Mecanismo Central: Score Multidimensional e Alavancas

### 4.1 A Matriz de Decisão
Cada município recebe quatro índices normalizados de 0 a 100. Os pesos são ajustáveis pelo usuário.

1. **Potencial de Mercado ($M$):**
   - Domicílios urbanos e renda domiciliar (IBGE, Censo 2022).
   - Penetração atual de banda larga fixa e presença de fibra (Anatel).
   - Market share móvel da Vivo no município (Anatel), que indica a base endereçável para o *Vivo Total*.
   - Concentração de mercado (HHI) e participação de PPPs.
2. **Impacto Educacional ($I$):**
   - Matrículas na rede pública e percentual de matrículas rurais (Censo Escolar).
   - **Déficit de banda:** $\text{Déficit} = \max(\text{alunos no maior turno} \times 1\text{ Mbps},\ 50\text{ Mbps}) - \text{velocidade medida}$.
     - A velocidade vem do Medidor Educação Conectada onde houver medição; nas demais escolas, é usada uma estimativa.
     - Os alunos no maior turno são estimados a partir das matrículas, pois os microdados públicos não trazem matrículas por turno de forma direta.
   - Escolas sem uso de internet para aprendizagem (`IN_INTERNET_APRENDIZAGEM`).
   - Índice de Vulnerabilidade Social (IPEA).
3. **Custo Estimado de Implantação ($C$):**
   - Distância até o município mais próximo com backhaul de fibra (proxy; a Anatel não publica o traçado das rotas).
   - Densidade de domicílios na área urbana.
   - Relevo (modelo digital de elevação).
4. **Alavancas ($A$):**
   - Inclusão no acordo de migração e ano previsto do backhaul.
   - Elegibilidade às modalidades do FUST.
   - Escolas cobertas por programas de conectividade (PIEC, EACE, FUST).

### 4.2 Os Quadrantes Estratégicos

```
                      IMPACTO SOCIAL (I)
                             ▲
                             │
            QUADRANTE 2      │      QUADRANTE 1
      [EXPANDIR C/ ALAVANCAS]│    [EXPANDIR JÁ]
                             │
     • Q2a: viável com       │ • Retorno comercial suficiente
       backhaul do acordo,   │ • CapEx próprio
       FUST ou programa      │ • Upsell convergente Vivo Total
       escolar               │
     • Q2b: satélite/FWA,    │
       recursos não reembols.│
─────────────────────────────┼─────────────────────────────► POTENCIAL DE
            QUADRANTE 4      │      QUADRANTE 3              MERCADO (M)
            [MONITORAR]      │ [EXPANSÃO COMERCIAL / M&A]
                             │
     • Demanda insuficiente  │ • Construir vs. comprar PPP
     • Manter em radar       │ • Decisão puramente privada
                             │
```
*PPP = Prestadora de Pequeno Porte.*

### 4.3 Simulação Ilustrativa: o Efeito do Backhaul Comprometido

**Município hipotético:** 20 mil habitantes, 4.800 domicílios urbanos, 12 escolas públicas e backhaul de fibra mais próximo a 40 km.

**Premissas (todas ajustáveis no simulador):**
- Custo de rede de acesso: R$ 477 por casa passada.
- Custo de backhaul: R$ 61,8 mil por km.
- Custo de ativação: R$ 500 por cliente.
- Adesão em maturidade: 25%.
- ARPU: R$ 87,70.
- Margem EBITDA: 40%.

Os valores de referência de custo devem ser calibrados com a Vivo no piloto.

| Métrica | A: Sem alavancas | B: Município do acordo (backhaul comprometido) | C: B + receita escolar* |
|---|---|---|---|
| CapEx rede de acesso (4.800 HPs) | R$ 2,29 mi | R$ 2,29 mi | R$ 2,29 mi |
| CapEx backhaul (40 km) | R$ 2,47 mi | — (já comprometido) | — |
| CapEx ativação (1.200 clientes) | R$ 0,60 mi | R$ 0,60 mi | R$ 0,60 mi |
| **CapEx incremental** | **R$ 5,36 mi** | **R$ 2,89 mi** | **R$ 2,89 mi** |
| Receita residencial | R$ 1,26 mi/ano | R$ 1,26 mi/ano | R$ 1,26 mi/ano |
| Receita escolar (12 × R$ 1.200/mês) | — | — | R$ 0,17 mi/ano |
| EBITDA (40%) | R$ 0,51 mi/ano | R$ 0,51 mi/ano | R$ 0,57 mi/ano |
| **Payback simples** | **~10,6 anos** | **~5,7 anos** | **~5,0 anos** |

\* A receita escolar só se aplica se a modalidade de contratação permitir cobrança. Em programas como o FUST reembolsável escolar, a conexão é oferecida sem custo para a escola, e as duas alavancas não devem ser somadas sem checar a regra do edital.

**Sensibilidade à taxa de adesão:**

| Adesão | A: Sem alavancas | B: Backhaul comprometido | C: B + receita escolar |
|---|---|---|---|
| 15% | ~16,9 anos | ~8,7 anos | ~7,1 anos |
| 25% | ~10,6 anos | ~5,7 anos | ~5,0 anos |
| 35% | ~7,9 anos | ~4,4 anos | ~4,0 anos |

**Leitura correta da simulação:**
- O backhaul comprometido reduz o payback deste exemplo de ~10,6 para ~5,7 anos. Isso só vale nos municípios da lista oficial do acordo e no ano em que o backhaul estiver disponível.
- **O efeito do FUST não aparece no payback simples.** Ele é medido no VPL, pelo diferencial de juros sobre a parcela financiada, usando as condições do edital vigente.
- **EBITDA não é fluxo de caixa.** A versão do MVP desconta impostos e manutenção e inclui uma rampa de adesão, que tornam os resultados acima mais conservadores.
- **Impacto social:** 12 escolas. A meta é atender o parâmetro da ENEC, com formação docente pela Fundação.

---

## 5. Arquitetura do Sistema

**Princípio de projeto:** agentes de IA onde há linguagem natural e ambiguidade; código determinístico onde há cálculo. O LLM não calcula scores nem otimiza; ele interpreta pedidos, chama ferramentas, consulta documentos regulatórios e explica os resultados.

```
                 ┌──────────────────────────────┐
                 │   USUÁRIO / ANALISTA         │
                 │   (Dashboard + Chat)         │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────▼───────────────┐
                 │   AGENTE ORQUESTRADOR        │
                 │   (watsonx Orchestrate)      │
                 └──────────────┬───────────────┘
                                │ chama ferramentas / agentes
   ┌────────────┬───────────────┼──────────────┬────────────────┐
   ▼            ▼               ▼              ▼                ▼
┌────────┐ ┌────────┐     ┌───────────┐  ┌───────────┐  ┌──────────────┐
│ Dados  │ │ Scores │     │ Financeiro│  │ Otimização│  │ Agente       │
│ (ETL)  │ │M,I,C,A │     │payback/VPL│  │ (CPLEX)   │  │ Regulatório  │
│ Python │ │ Python │     │ Python    │  │           │  │ (RAG/Granite)│
└───┬────┘ └────────┘     └───────────┘  └───────────┘  └──────────────┘
    ▼
┌──────────────────────┐        ┌──────────────────────────────┐
│ GeoParquet /         │        │ AGENTE DE JUSTIFICATIVA      │
│ watsonx.data         │        │ (Granite via watsonx.ai)     │
└──────────────────────┘        └──────────────┬───────────────┘
                                               ▼
                                ┌──────────────────────────────┐
                                │ watsonx.governance           │
                                │ (registro e auditoria)       │
                                └──────────────────────────────┘
```

### 5.1 Componentes

#### 1. Agente Orquestrador (watsonx Orchestrate)
- **Função:** interpreta pedidos em linguagem natural e decide qual ferramenta ou agente acionar. Exemplo: "simule o Nordeste com R$ 30 mi e o backhaul do acordo ativado".
- **Saída:** respostas compostas a partir dos resultados das ferramentas.

#### 2. Ferramenta de Dados (determinística)
- **Função:** ingestão, validação de esquema, detecção de dados desatualizados e reconciliação de chaves (`id_municipio` IBGE, `CO_ENTIDADE` INEP).
- **Saída:** base municipal e base de escolas em GeoParquet, particionadas por UF.

#### 3. Ferramenta de Scores (determinística)
- **Função:** calcula $M$, $I$, $C$ e $A$, as distâncias até o backhaul e o déficit de banda por escola.
- **Saída:** índices normalizados e classificação em quadrantes.

#### 4. Ferramenta Financeira (determinística)
- **Função:** calcula CapEx, payback e VPL por município, com e sem cada alavanca, a partir das premissas ajustáveis.
- **Saída:** business case comparativo e análise de sensibilidade.

#### 5. Ferramenta de Otimização (IBM Decision Optimization / CPLEX)
- **Função:** seleciona o portfólio de municípios do recorte filtrado, sob restrição de orçamento.
- **Solver:** a Community Edition do CPLEX (até 1000 variáveis) atende qualquer estado. Recortes maiores (região ou Brasil) exigem o CPLEX completo ou um solver aberto (CBC).
- **Formulação (programação inteira):**
  - Maximizar $\sum_i x_i \cdot [\lambda \cdot \hat{I}_i + (1-\lambda) \cdot \widehat{VPL}_i]$.
  - Sujeito a $\sum_i x_i \cdot \text{CapEx}_i \le \text{Orçamento}$.
  - Sujeito a $\text{payback}_i \le P_{max}$ para todo município selecionado.
  - Sujeito a $x_i \in \{0,1\}$.
  - $\lambda$ é o peso entre impacto social e retorno, definido pelo usuário.
  - As obrigações do acordo entram como parâmetros fixos.
- **Saída:** portfólio recomendado, curva de payback e mapa de migração entre quadrantes.

#### 6. Agente Regulatório (RAG com Granite via watsonx.ai)
- **Função:** responde perguntas de elegibilidade com citação da fonte, a partir de uma base com o acordo de migração, os editais e regras do FUST e os documentos da ENEC.
- **Regras críticas:** as regras que afetam o cálculo também são codificadas numa tabela de regras revisada manualmente, para que o resultado numérico não dependa do LLM.

#### 7. Agente de Justificativa (Granite via watsonx.ai)
- **Função:** redige a justificativa de cada recomendação **exclusivamente a partir dos valores calculados**.
- **Conteúdo:** fontes dos dados, premissas usadas, nível de incerteza (por exemplo, velocidade medida × estimada) e principais riscos.
- **Governança:** prompts, versões e avaliações de fidelidade das respostas ficam registrados no **watsonx.governance**.

---

## 6. Engenharia de Dados e Pipeline

### 6.1 Fontes de Dados

| Domínio | Fonte | Granularidade | Variáveis-chave |
|---|---|---|---|
| **Banda larga fixa** | Anatel, via Base dos Dados (BigQuery) | Mês × município × prestadora × tecnologia | Acessos, tecnologia, faixa de velocidade, porte da prestadora |
| **Telefonia móvel** | Anatel, via Base dos Dados (BigQuery) | Mês × município × prestadora | Acessos por operadora, base para o share da Vivo |
| **Backhaul** | Anatel, "Infraestrutura: Backhaul em municípios" (dados.gov.br, CSV) | Município | Presença e tecnologia do backhaul, número de prestadoras |
| **Educação básica** | Censo Escolar (INEP / Base dos Dados) | Escola (`CO_ENTIDADE`) | `IN_INTERNET`, `IN_INTERNET_APRENDIZAGEM`, `IN_BANDA_LARGA`, matrículas, localização |
| **Velocidade escolar** | Medidor Educação Conectada (NIC.br/MEC) | Escola | Velocidade medida (verificar disponibilidade de extração por escola) |
| **Geolocalização de escolas** | Catálogo de Escolas (INEP) / `geobr` | Coordenadas | Latitude, longitude, código INEP |
| **Demografia e renda** | IBGE, Censo 2022 | Setor censitário / município | Domicílios, população, renda |
| **Alavancas** | Acordo de migração, editais FUST, ENEC/EACE | Município / escola | Lista oficial do acordo, elegibilidade, escolas atendidas por programa |

### 6.2 Pipeline
1. **Extração:** consultas particionadas no BigQuery (`basedosdados`) e download dos CSVs da Anatel e do INEP. São usados apenas meses já fechados da Anatel, pois o dado preliminar é revisado no mês seguinte.
2. **Reconciliação:** escolas ligadas às coordenadas por `CO_ENTIDADE`; todas as bases ligadas por `id_municipio`.
3. **Distâncias:** distância de cada sede municipal e escola até o município mais próximo com backhaul de fibra, por vizinho mais próximo, com refinamento por malha viária (OpenStreetMap) quando possível.
4. **Armazenamento:** GeoParquet particionado por UF, ou tabelas no watsonx.data.

---

## 7. Valor Econômico da Solução (Hipóteses a Validar)

O Conecta+ atua sobre a qualidade da escolha de onde investir em expansão de rede. Os ganhos dependem de dados internos da Vivo e por isso são apresentados como **hipóteses testáveis no piloto**, e não como resultados.

### 7.1 Vetores de Valor

| Vetor | Mecanismo | Como medir no piloto |
|---|---|---|
| **Eficiência na escolha de municípios** | Priorizar municípios com maior retorno ajustado e menor risco. | Comparar o retorno previsto do portfólio recomendado com o portfólio de referência. |
| **Aproveitamento do backhaul do acordo** | Levar FTTH aos municípios onde o backhaul já será construído por obrigação. | Receita FTTH incremental nos municípios do acordo. |
| **Uso das linhas e modalidades do FUST** | Identificar projetos elegíveis e o efeito do custo de capital no VPL. | Diferencial de VPL com e sem FUST nos projetos elegíveis. |
| **Eficiência de planejamento** | Automatizar a montagem de diagnósticos e business cases. | Horas por análise, antes e depois. |

### 7.2 Ponto de Equilíbrio da Ferramenta
- **Custo estimado:** a equipe estima R$ 4,5 milhões no ano 1 (estimativa preliminar) e R$ 2,5 milhões/ano a partir do ano 2.
- **Ponto de equilíbrio:** a ferramenta se paga se melhorar a eficiência do CapEx de expansão que ela orienta (E) em pelo menos $\text{custo} / E$.

| CapEx de expansão orientado pela ferramenta (E, hipótese) | Ganho de eficiência necessário no ano 1 |
|---|---|
| R$ 0,5 bi/ano | 0,90% |
| R$ 1,0 bi/ano | 0,45% |
| R$ 2,0 bi/ano | 0,23% |

O valor de E deve ser definido com a Vivo.

---

## 8. Escopo do MVP

### 8.1 Módulos Entregáveis
1. **Painel cartográfico nacional com filtro geográfico:**
   - Cobre os 5.570 municípios. O usuário escolhe o recorte: Brasil inteiro, uma região (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) ou um estado.
   - Os scores usam escala nacional, então o score de um município é o mesmo em qualquer recorte. A posição do município dentro do recorte também é exibida.
   - Cores por quadrante: verde Q1, azul Q2a, roxo Q2b, amarelo Q3, cinza Q4.
   - Camadas: municípios com backhaul de fibra, municípios do acordo de migração, escolas com déficit em relação à ENEC (medido ou estimado), share móvel da Vivo.
2. **Simulador de alavancas:**
   - Controle de orçamento, aplicado ao recorte selecionado.
   - Chaves `[Backhaul do acordo]`, `[FUST]` e `[Receita escolar]`.
   - Premissas editáveis: custos, adesão, ARPU e margem.
   - Visualização dos municípios que mudam de quadrante e do efeito no payback e no VPL.
3. **Chat com justificativa e rastreabilidade:**
   - Exemplo de pergunta: *"Quais municípios do semiárido maximizam alunos atendidos por real investido com payback abaixo de 6 anos?"*
   - Respostas com métricas, fontes e indicação do que é medido e do que é estimado.
4. **Ficha executiva de 1 página por município:**
   - Diagnóstico sociodemográfico e educacional.
   - Business case com e sem alavancas.
   - Plano de ação sugerido: tecnologia indicada e ação pedagógica para a Fundação.
5. **Validação retroativa (backtest):**
   - Calcular os scores com dados de 2021 e verificar se anteciparam onde a fibra cresceu até 2025, usando a série histórica da Anatel.
   - É a principal evidência de que o modelo funciona.

### 8.2 Roteiro da Demonstração (Pitch de 4 Minutos)

> **Nota:** os números mostrados na demo serão os calculados pelo MVP com dados reais. Os marcados como [N] não são definidos de antemão.

- **0:00–0:30 | Gancho:**
  *"A Vivo leva fibra até a casa em 453 cidades, cerca de 8% dos municípios do Brasil, e investiu R$ 9,3 bilhões em 2025. Ao mesmo tempo, há bilhões em fundos públicos e obrigações regulatórias voltados à conectividade. O Conecta+ coloca tudo isso na mesma decisão."*
- **0:30–1:15 | Do Brasil ao estado:**
  O mapa abre no Brasil inteiro. O filtro desce para uma região e depois para um estado, destacando os municípios no Quadrante 2, com escolas abaixo do parâmetro da ENEC e retorno comercial insuficiente isoladamente.
- **1:15–2:15 | Simulador:**
  O operador define um orçamento e ativa as alavancas. [N] municípios mudam de quadrante, e o payback médio vai de [X] para [Y] anos.
- **2:15–3:00 | Justificativa:**
  Pergunta: *"Por que priorizar o município X sobre o Y?"* O agente responde com os números calculados, as fontes e o grau de incerteza.
- **3:00–3:30 | Ficha e papel da Fundação:**
  Ficha de um município, com a infraestrutura entregue pela operadora e o plano de formação docente da Fundação.
- **3:30–4:00 | Evidência e fechamento:**
  Resultado do backtest e ponto de equilíbrio da ferramenta.

---

## 9. Riscos, Limitações dos Dados e Mitigação

| Ponto sensível | Risco | Mitigação |
|---|---|---|
| **Velocidade escolar** | O Censo traz só indicadores binários. O Medidor cobre cerca de 57% das escolas estaduais e municipais. | Usar a velocidade medida onde existir e estimar as demais; marcar na ficha o que é medido e o que é estimado. |
| **Matrículas por turno** | Os microdados públicos não trazem diretamente os alunos no maior turno. | Estimativa a partir das matrículas e das etapas atendidas; deixar explícito no cálculo do déficit. |
| **Backhaul** | A Anatel publica presença por município, não o traçado nem o ponto de presença. | Distância ao município mais próximo com fibra como proxy, com incerteza registrada. |
| **Lista do acordo de migração** | A lista foi ajustada por exigência do TCU; o backhaul é entregue ao longo de dez anos. | Usar apenas a lista oficial final e considerar o ano previsto de cada backhaul. |
| **Receita escolar** | Algumas modalidades oferecem a conexão sem custo para a escola. | Tratar a receita escolar como opcional e condicionada à regra de cada programa. |
| **Atraso de dados das PPPs** | Pequenos provedores atrasam o envio de dados, e a Anatel revisa os números preliminares. | Usar meses fechados; ajuste estatístico de penetração em municípios pequenos. |
| **Premissas financeiras** | Custos, adesão e ARPU locais podem diferir muito da média nacional. | Premissas editáveis, análise de sensibilidade e calibração com a Vivo no piloto. |
| **Alucinação do LLM** | Justificativas com números ou regras incorretas. | O agente só usa valores calculados e documentos indexados; avaliações de fidelidade no watsonx.governance. |

---

## 10. Roadmap

```
                      HORIZONTE DE DESENVOLVIMENTO
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│     FASE 1: MVP         │  │     FASE 2: ESCALA      │  │    FASE 3: EXPANSÃO     │
│   (Competição / 3m)     │  │     (6 a 12 meses)      │  │     (12 a 24 meses)     │
├─────────────────────────┤  ├─────────────────────────┤  ├─────────────────────────┤
│• Brasil inteiro, com    │  │• Recomendação de        │  │• Módulo Saúde (UBSs)    │
│  filtro Brasil/região/UF│  │  tecnologia (FTTH × FWA │  │• Portal para Secretarias│
│• Orquestrador +         │  │  × satélite)            │  │  de Educação            │
│  ferramentas + agentes  │  │• Construir × comprar PPP│  │• Integração com sistemas│
│• Scores e alavancas     │  │• Filtros sub-estaduais  │  │  de planejamento da     │
│• Backtest 2021→2025     │  │  (semiárido, mesorregião│  │  operadora              │
│• Dashboard, chat e ficha│  │  raio em km)            │  │                         │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```

1. **Recomendação de tecnologia:** FTTH para áreas urbanas densas, FWA para periferias e satélite ou rádio para escolas rurais isoladas.
2. **Construir × comprar:** identificar PPPs com rede instalada em municípios-alvo, como alternativa à sobreposição de rede.
3. **Outros pontos de interesse público:** Unidades Básicas de Saúde como clientes institucionais adicionais.
4. **Versão para o setor público:** apoio ao MCom e ao BNDES no desenho de editais do FUST.

---

## Referências

- Telefônica Brasil — Resultados 4T25: https://stocks.observer-reporter.com/observerreporter/article/newsfile-2026-2-23-4q25-results-telefonica-brasil-sa
- Telefônica Brasil — Teleconferência 4T25: https://www.marketbeat.com/instant-alerts/telefonica-brasil-q4-earnings-call-highlights-2026-02-23/
- Times Brasil — Resultados Vivo 1T26: https://timesbrasil.com.br/empresas-e-negocios/tecnologia-e-inovacao/lucro-vivo-sobe-19-por-cento-1t26-resultados-movel-pos-pago-fibra/
- Teletime — Vivo passa a deter 100% da FiBrasil: https://teletime.com.br/18/05/2026/vivo-compra-fatia-remanescente-e-passa-a-deter-100-da-fibrasil/
- Teletime — Market share de banda larga, jun/2025: https://teletime.com.br/04/08/2025/vivo-claro-e-starlink-lideram-adicoes-na-banda-larga-em-junho/
- Mobile Time — TIC Domicílios 2025: https://www.mobiletime.com.br/noticias/09/12/2025/tic-domicilios-2025/
- Cetic.br — TIC Domicílios 2025, tabela A10: https://cetic.br/en/tics/domicilios/2025/domicilios/A10/
- MEC — Nota Técnica ENEC: https://www.gov.br/mec/pt-br/escolas-conectadas/documentos/NotaTcnica.pdf
- Teletime — Panorama NIC.br da conexão nas escolas: https://teletime.com.br/23/05/2024/qualidade-da-conexao-em-escolas-do-brasil-esta-abaixo-do-recomendado/
- Convergência Digital — ENEC atinge 99 mil escolas: https://convergenciadigital.com.br/governo/escolas-conectadas-pais-atinge-a-marca-de-99-mil-instituicoes-publicas-com-internet/
- O Liberal — Composição dos R$ 8,8 bi da ENEC: https://www.oliberal.com/para/escolas-conectadas-leva-internet-a-5-379-instituicoes-de-ensino-no-para-1.730457
- Teletime — Conselho do FUST aprova até R$ 1,25 bi em 2025: https://teletime.com.br/04/07/2025/conselho-do-fust-aprova-ate-r-125-bi-em-repasse-ao-bndes-em-2025/
- DPL News — Orçamento FUST 2025: https://dplnews.com/?p=250060
- Teletime — FUST Direto e não reembolsável: https://teletime.com.br/06/05/2025/mcom-trabalha-em-novos-editais-para-fust-direto-e-nao-reembolsavel/
- Teletime — Edital FUST de R$ 53 mi: https://teletime.com.br/22/09/2025/fust-mcom-aprova-diretrizes-de-novo-edital-com-r-53-milhoes-para-escolas/
- MEC — Ofício FUST Reembolsável escolar: https://www.gov.br/mec/pt-br/escolas-conectadas/Demanda1509SEI_MEC5640907Ofcio529.pdf
- Convergência Digital — TCU aprova acordo da Vivo: https://convergenciadigital.com.br/governo/tcu-aprova-acordo-de-r-45-bilhoes-para-fim-da-concessao-de-telefonia-fixa-da-vivo/
- Convergência Digital — Vivo assina acordo: https://convergenciadigital.com.br/governo/vivo-se-compromete-a-investir-r-45-bilhoes-e-esta-autorizada-a-migrar-da-concessao-para-o-regime-privado/
- Teletime — Aprender Conectado, 14 mil escolas: https://teletime.com.br/08/12/2025/aprender-conectado-140-escolas-por-dia/
- Teletime — Aprender Conectado, meta de 40 mil escolas: https://teletime.com.br/30/09/2025/aprender-conectado-alcanca-10-mil-escolas-publicas-atendidas/

---
*Documento elaborado para o Desafio IBM SkillsBuild & Fundação Telefônica Vivo.*
