# Conecta+ — Divisão de Trabalho

## Rafael — Scores, Financeiro & Otimização

Foco nos algoritmos e no motor de decisão do sistema.

| Entregável | Seção da proposta | Status |
|---|---|---|
| Cálculo dos scores M, I, C, A | §4.1 | ✅ Concluído |
| Cálculo de distâncias ao backhaul | §4.1 / §6.2 | ✅ Concluído |
| Ferramenta Financeira (payback, VPL, sensibilidade) | §5 — Componente 4 | ✅ Concluído |
| Ferramenta de Otimização (CPLEX / portfólio) | §5 — Componente 5 | ✅ Concluído |
| Backtest 2021→2025 | §8.1 — Módulo 5 | ✅ Concluído |

---

## Joel — Produto & Dashboard

Interface e experiência do usuário.

| Entregável | Seção da proposta | Status |
|---|---|---|
| Painel cartográfico (5.570 municípios, filtros, quadrantes) | §8.1 — Módulo 1 | ✅ Concluído |
| Simulador de alavancas | §8.1 — Módulo 2 | ✅ Concluído |
| Chat com justificativa (UI) | §8.1 — Módulo 3 | ✅ Concluído |
| Ficha executiva por município | §8.1 — Módulo 4 | ✅ Concluído |

---

## Chris — ETL + Agentes de IA & Orquestração

Backend de dados + camada inteligente. Os dados que ingere são os mesmos que os agentes consomem.

| Entregável | Seção da proposta | Status |
|---|---|---|
| Pipeline ETL (Anatel, INEP, IBGE, NIC.br) | §6 | ✅ Concluído |
| Base municipal e de escolas em GeoParquet | §6.2 | ✅ Concluído |
| Agente Orquestrador (watsonx Orchestrate) | §5 — Componente 1 | ✅ Concluído |
| Agente Regulatório (RAG com Granite) | §5 — Componente 6 | ✅ Concluído |
| Agente de Justificativa (Granite via watsonx.ai) | §5 — Componente 7 | ✅ Concluído |
| Registro e auditoria no watsonx.governance | §5 — Componente 7 | ✅ Concluído |

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
