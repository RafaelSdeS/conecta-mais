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

import logging
import os
import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd
import pulp

from conecta.financial.calculator import capex, npv, payback
from conecta.financial.models import Alavancas, FinancialParams
from conecta.scores.models import ScoreWeights

logger = logging.getLogger(__name__)


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
    solver: str = "CBC"               # Solver que resolveu o MILP


def _minmax_series(s: pd.Series) -> pd.Series:
    lo, hi = s.min(), s.max()
    if hi == lo:
        return pd.Series(0.5, index=s.index)
    return (s - lo) / (hi - lo)


def num_escolas_b2g(row) -> int:
    """Escolas que geram receita B2G quando a alavanca ENEC está ligada: as sem internet para aprendizagem."""
    return int(row.get("escolas_sem_internet_aprendizagem", 0) or 0)


# ponytail: sem prova de otimalidade quando estoura. Medido no Brasil inteiro: 2 s fica a até 0,35% do objetivo de 30 s,
# bem menos que a incerteza das premissas, e 30 s travava a tela a cada mudança de cenário. Aumentar se a decisão pedir.
LIMITE_SOLVER_S = 3


def _escolhe_solver() -> tuple[pulp.LpSolver, str]:
    """CBC por padrão. CONECTA_SOLVER=cplex usa o IBM CPLEX se estiver instalado e licenciado."""
    if os.getenv("CONECTA_SOLVER", "").strip().lower() == "cplex":
        cplex = pulp.CPLEX_CMD(msg=0, timeLimit=LIMITE_SOLVER_S)
        if cplex.available():
            return cplex, "CPLEX"
        logger.warning("CONECTA_SOLVER=cplex, mas o CPLEX não está disponível: usando CBC.")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        return pulp.PULP_CBC_CMD(msg=0, timeLimit=LIMITE_SOLVER_S), "CBC"


def add_financials(
    df: pd.DataFrame, params: FinancialParams, alavancas: Alavancas
) -> pd.DataFrame:
    """
    Acrescenta _capex, _payback e _npv (business case) a cada município.

    Alavanca TCU: só zera o backhaul dos municípios marcados no acordo (acordo_migracao).
    """
    out = df.copy()
    cx, pb, vpl = [], [], []
    for _, row in out.iterrows():
        alav = alavancas.model_copy(
            update={
                "backhaul_comprometido": alavancas.backhaul_comprometido
                and bool(row.get("acordo_migracao", False)),
                "num_escolas": num_escolas_b2g(row),
            }
        )
        homes = int(row["domicilios_urbanos"])
        dist = float(row.get("dist_backhaul_km") or 0.0)
        cx.append(capex(homes, dist, params, alav).total)
        pb.append(payback(homes, dist, params, alav))
        vpl.append(npv(homes, dist, params, alav))
    out["_capex"], out["_payback"], out["_npv"] = cx, pb, vpl
    return out


def optimize_portfolio(
    municipios_df: pd.DataFrame,
    params: FinancialParams,
    alavancas: Alavancas,
    budget: float,
    lambda_: float = 0.5,
    max_payback: float = 10.0,
    weights: ScoreWeights | None = None,
    objetivo_modo: str = "equilibrado",
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
        objetivo_modo: "retorno" (só VPL), "equilibrado" (usa lambda_) ou "alunos"
                       (maximiza alunos em escolas sem internet).

    Returns:
        PortfolioResult com os municípios selecionados e métricas agregadas.
    """
    if weights is None:
        weights = ScoreWeights()

    df = municipios_df.copy()
    solver, solver_nome = _escolhe_solver()

    # ── 1. Calcular business case para cada município ─────────────────────────
    if "_capex" not in df.columns:  # o chamador pode passar o resultado já calculado (cache)
        df = add_financials(df, params, alavancas)

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
            solver=solver_nome,
        )

    # ── 3. Normalizar Î (score_I) e VPL̂ ──────────────────────────────────────
    if "score_I" not in candidatos.columns:
        candidatos["score_I"] = 50.0   # fallback se scores ainda não calculados

    norm_I   = _minmax_series(candidatos["score_I"])
    norm_npv = _minmax_series(candidatos["_npv"])

    if objetivo_modo == "alunos" and "alunos_sem_internet" in candidatos.columns:
        objetivo = _minmax_series(candidatos["alunos_sem_internet"])
    else:
        lam = 0.0 if objetivo_modo == "retorno" else lambda_
        objetivo = lam * norm_I + (1 - lam) * norm_npv

    # ── 4. Problema PuLP ──────────────────────────────────────────────────────
    idx = list(candidatos.index)
    prob = pulp.LpProblem("portfolio_conecta", pulp.LpMaximize)
    # LpVariable.dicts será removido no PuLP 4.0; usando dict comprehension equivalente
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        x = pulp.LpVariable.dicts("x", idx, cat="Binary")

    # Função objetivo
    prob += pulp.lpSum(x[i] * float(objetivo.loc[i]) for i in idx)

    # Restrição de orçamento
    prob += pulp.lpSum(x[i] * float(candidatos.loc[i, "_capex"]) for i in idx) <= budget

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
            solver=solver_nome,
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
        solver=solver_nome,
    )
