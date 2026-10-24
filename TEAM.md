# Conecta+ — Divisão de Trabalho

## Rafael — Scores, Financeiro & Otimização

Foco nos algoritmos e no motor de decisão do sistema.

| Entregável | Seção da proposta |
|---|---|
| Cálculo dos scores M, I, C, A | §4.1 |
| Cálculo de distâncias ao backhaul | §4.1 / §6.2 |
| Ferramenta Financeira (payback, VPL, sensibilidade) | §5 — Componente 4 |
| Ferramenta de Otimização (CPLEX / portfólio) | §5 — Componente 5 |
| Backtest 2021→2025 | §8.1 — Módulo 5 |

---

## Chris — Produto & Dashboard

Interface e experiência do usuário.

| Entregável | Seção da proposta |
|---|---|
| Painel cartográfico (5.570 municípios, filtros, quadrantes) | §8.1 — Módulo 1 |
| Simulador de alavancas | §8.1 — Módulo 2 |
| Chat com justificativa (UI) | §8.1 — Módulo 3 |
| Ficha executiva por município | §8.1 — Módulo 4 |

---

## Joel — ETL + Agentes de IA & Orquestração

Backend de dados + camada inteligente. Os dados que ingere são os mesmos que os agentes consomem.

| Entregável | Seção da proposta |
|---|---|
| Pipeline ETL (Anatel, INEP, IBGE, NIC.br) | §6 |
| Base municipal e de escolas em GeoParquet | §6.2 |
| Agente Orquestrador (watsonx Orchestrate) | §5 — Componente 1 |
| Agente Regulatório (RAG com Granite) | §5 — Componente 6 |
| Agente de Justificativa (Granite via watsonx.ai) | §5 — Componente 7 |
| Registro e auditoria no watsonx.governance | §5 — Componente 7 |

---

## Fluxo de dependências

```
Rafael (scores, financeiro, otimização)
    └──► Joel (dashboard, simulador, ficha)

Chris (ETL + dados)
    ├──► Rafael (base municipal e de escolas)
    ├──► Joel (dashboard, chat)
    └──► Chris (agentes consomem a própria base)
```

> Os três podem trabalhar em paralelo desde o início usando dados simulados
> nas interfaces de Joel e nos agentes de Chris. O fluxo real é Chris → Rafael → Joel.
