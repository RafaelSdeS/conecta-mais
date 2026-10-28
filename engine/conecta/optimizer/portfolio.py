"""
Ferramenta de Otimização de Portfólio — Conecta+.

Formulação (§5.1 Componente 5):
    max  Σ_i x_i · [λ · Î_i + (1-λ) · VPL̂_i]
    s.a. Σ_i x_i · CapEx_i ≤ budget
         payback_i ≤ max_payback   ∀ i (pré-filtro)
         x_i ∈ {0, 1}

onde Î e VPL̂ são normalizações min-max dentro do recorte filtrado.

Solver: PuLP + CBC (open-source, sem licença).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import pulp

from conecta.financial.calculator import business_case
from conecta.financial.models import Alavancas, FinancialParams
from conecta.scores.models import ScoreWeights


@dataclass
class PortfolioResult:
    """Resultado da otimização de portfólio."""

    municipios: pd.DataFrame          # linhas selecionadas com colunas de score e financeiro
    capex_total: float                # CapEx total alocado (R$ mi)
    payback_medio: float              # Payback médio ponderado por CapEx
    score_total: float                # Soma do score_total dos selecionados
    status: str                       # Status do solver PuLP ("Optimal", "Infeasible", etc.)
    n_candidatos: int                 # Municípios elegíveis antes da otimização
    n_selecionados: int               # Municípios no portfólio final


def _minmax_series(s: pd.Series) -> pd.Series:
    lo, hi = s.min(), s.max()
    if hi == lo:
        return pd.Series(0.5, index=s.index)
    return (s - lo) / (hi - lo)


def optimize_portfolio(
    municipios_df: pd.DataFrame,
    params: FinancialParams,
    alavancas: Alavancas,
    budget: float,
    lambda_: float = 0.5,
    max_payback: float = 10.0,
    weights: ScoreWeights | None = None,
) -> PortfolioResult:
    """
    Seleciona o portfólio ótimo de municípios.

    Args:
        municipios_df: DataFrame com scores e campos do schema Municipio.
                       Deve conter dist_backhaul_km já calculada.
        params:        Premissas financeiras (FinancialParams).
        alavancas:     Alavancas ativas para o cálculo do business case.
        budget:        Orçamento de CapEx disponível (R$ mi).
        lambda_:       Peso do impacto social vs. retorno financeiro [0, 1].
                       lambda_=1 → só impacto; lambda_=0 → só VPL.
        max_payback:   Payback máximo aceitável (anos). Municípios acima
                       são excluídos antes do solver.
        weights:       Pesos dos scores (usado para score_total).

    Returns:
        PortfolioResult com os municípios selecionados e métricas agregadas.
    """
    if weights is None:
        weights = ScoreWeights()

    df = municipios_df.copy()

    # ── 1. Calcular business case para cada município ─────────────────────────
    capex_list, payback_list, npv_list = [], [], []

    for _, row in df.iterrows():
        bc = business_case(
            id_municipio=str(row["id_municipio"]),
            domicilios_urbanos=int(row["domicilios_urbanos"]),
            dist_backhaul_km=float(row.get("dist_backhaul_km") or 0.0),
            num_escolas=int(row.get("eace_escolas", 0)),
            params=params,
            alavancas=alavancas.model_copy(
                update={"backhaul_comprometido": bool(row.get("acordo_migracao", False))}
            ),
        )
        capex_list.append(bc.capex.total)
        payback_list.append(bc.payback_anos)
        npv_list.append(bc.npv)

    df["_capex"]   = capex_list
    df["_payback"] = payback_list
    df["_npv"]     = npv_list

    # ── 2. Pré-filtro: payback e orçamento individual ─────────────────────────
    elegivel = df["_payback"] <= max_payback
    candidatos = df[elegivel].copy()
    n_candidatos = len(candidatos)

    # Portfólio vazio se não há candidatos ou orçamento zero
    if n_candidatos == 0 or budget <= 0:
        return PortfolioResult(
            municipios=df.iloc[0:0],
            capex_total=0.0,
            payback_medio=0.0,
            score_total=0.0,
            status="Infeasible" if n_candidatos > 0 else "NoFeasibleCandidates",
            n_candidatos=n_candidatos,
            n_selecionados=0,
        )

    # ── 3. Normalizar Î (score_I) e VPL̂ ──────────────────────────────────────
    if "score_I" not in candidatos.columns:
        candidatos["score_I"] = 50.0   # fallback se scores ainda não calculados

    norm_I   = _minmax_series(candidatos["score_I"])
    norm_npv = _minmax_series(candidatos["_npv"])

    objetivo = lambda_ * norm_I + (1 - lambda_) * norm_npv

    # ── 4. Problema PuLP ──────────────────────────────────────────────────────
    idx = list(candidatos.index)
    prob = pulp.LpProblem("portfolio_conecta", pulp.LpMaximize)
    x = pulp.LpVariable.dicts("x", idx, cat="Binary")

    # Função objetivo
    prob += pulp.lpSum(x[i] * float(objetivo.loc[i]) for i in idx)

    # Restrição de orçamento
    prob += pulp.lpSum(x[i] * float(candidatos.loc[i, "_capex"]) for i in idx) <= budget

    # Resolver silenciosamente
    solver = pulp.PULP_CBC_CMD(msg=0)
    prob.solve(solver)

    status = pulp.LpStatus[prob.status]

    # ── 5. Extrair solução ────────────────────────────────────────────────────
    selecionados_idx = [i for i in idx if pulp.value(x[i]) > 0.5]
    selecionados = candidatos.loc[selecionados_idx].copy()

    if selecionados.empty:
        return PortfolioResult(
            municipios=selecionados,
            capex_total=0.0,
            payback_medio=0.0,
            score_total=0.0,
            status=status,
            n_candidatos=n_candidatos,
            n_selecionados=0,
        )

    capex_total = float(selecionados["_capex"].sum())

    # Payback médio ponderado por CapEx
    payback_medio = float(
        np.average(selecionados["_payback"], weights=selecionados["_capex"])
    )

    score_col = "score_total" if "score_total" in selecionados.columns else "score_I"
    score_total = float(selecionados[score_col].sum())

    return PortfolioResult(
        municipios=selecionados,
        capex_total=round(capex_total, 4),
        payback_medio=round(payback_medio, 2),
        score_total=round(score_total, 2),
        status=status,
        n_candidatos=n_candidatos,
        n_selecionados=len(selecionados),
    )
