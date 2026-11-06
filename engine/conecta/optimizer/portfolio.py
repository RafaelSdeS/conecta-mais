"""
Ferramenta de Otimização de Portfólio — Conecta+.

Formulação (§5.1 Componente 5):
    max  Σ_i x_i · [λ · Î_i + (1-λ) · VPL̂_i]
    s.a. Σ_i x_i · CapEx_i ≤ budget
         payback_i ≤ max_payback   ∀ i (pré-filtro)
         x_i ∈ {0, 1}

onde Î e VPL̂ são normalizações min-max dentro do recorte filtrado.

Solver: PuLP + CBC (open-source, sem licença).

Resultados ficam em memória por entrada idêntica (dados, premissas, orçamento e opções): o painel,
o chat, a justificativa e os achados repetem o mesmo plano sem resolver o MILP de novo. Recortes
grandes podem levar até o limite de 30 s do solver.
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import warnings
from dataclasses import dataclass, field, replace

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


def _escolhe_solver() -> tuple[pulp.LpSolver, str]:
    """CBC por padrão. CONECTA_SOLVER=cplex usa o IBM CPLEX se estiver instalado e licenciado."""
    if os.getenv("CONECTA_SOLVER", "").strip().lower() == "cplex":
        cplex = pulp.CPLEX_CMD(msg=0, timeLimit=30)
        if cplex.available():
            return cplex, "CPLEX"
        logger.warning("CONECTA_SOLVER=cplex, mas o CPLEX não está disponível: usando CBC.")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        return pulp.PULP_CBC_CMD(msg=0, timeLimit=30), "CBC"  # limite de 30 s; sem prova de otimalidade se estourar


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
    incluir: list[str] | None = None,
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
        incluir:       Códigos IBGE forçados no portfólio (simula "o que mudaria para
                       incluir"). Os que estão acima do teto de payback são ignorados.

    Returns:
        PortfolioResult com os municípios selecionados e métricas agregadas.
    """
    if weights is None:
        weights = ScoreWeights()
    try:
        chave = (
            hashlib.sha1(pd.util.hash_pandas_object(municipios_df).values.tobytes()).digest(),
            tuple(municipios_df.columns), params.model_dump_json(), alavancas.model_dump_json(),
            float(budget), float(lambda_), float(max_payback), weights.model_dump_json(),
            objetivo_modo, tuple(sorted(incluir or ())), os.getenv("CONECTA_SOLVER", ""),
        )
    except TypeError:  # coluna com valores sem hash: resolve sem guardar
        return _resolver(municipios_df, params, alavancas, budget, lambda_, max_payback, weights,
                         objetivo_modo, incluir)
    if chave not in _cache_planos:
        if len(_cache_planos) >= _MAX_CACHE_PLANOS:
            _cache_planos.pop(next(iter(_cache_planos)))  # descarta o mais antigo
        _cache_planos[chave] = _resolver(municipios_df, params, alavancas, budget, lambda_,
                                         max_payback, weights, objetivo_modo, incluir)
    r = _cache_planos[chave]
    return replace(r, municipios=r.municipios.copy())  # quem chama pode alterar sem afetar o cache


_MAX_CACHE_PLANOS = 64
_cache_planos: dict[tuple, PortfolioResult] = {}


def _resolver(
    municipios_df: pd.DataFrame,
    params: FinancialParams,
    alavancas: Alavancas,
    budget: float,
    lambda_: float,
    max_payback: float,
    weights: ScoreWeights,
    objetivo_modo: str,
    incluir: list[str] | None,
) -> PortfolioResult:
    """Monta e resolve o MILP (sem cache)."""
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
        # Proporcional ao total (sem subtrair o mínimo, como no min-max): maximiza exatamente a
        # soma de alunos. Sem nenhum aluno no recorte, todos valem o mesmo.
        alunos = candidatos["alunos_sem_internet"]
        objetivo = alunos / alunos.max() if alunos.max() > 0 else _minmax_series(alunos)
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

    # Inclusão forçada: se o CapEx dos forçados passa do orçamento, o solver devolve Infeasible.
    if incluir:
        forcados = candidatos.index[candidatos["id_municipio"].astype(str).isin(incluir)]
        for i in forcados:
            prob += x[i] == 1

    prob.solve(solver)

    status = pulp.LpStatus[prob.status]

    # ── 5. Extrair solução ────────────────────────────────────────────────────
    # Inviável (ex.: inclusão forçada acima do orçamento): sem solução para extrair.
    selecionados_idx = (
        [] if status == "Infeasible" else [i for i in idx if (pulp.value(x[i]) or 0) > 0.5]
    )
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


def alunos_atendidos(sel: pd.DataFrame) -> int:
    return int(sel["alunos_sem_internet"].sum()) if "alunos_sem_internet" in sel.columns else 0


def situacao_no_plano(
    fin: pd.DataFrame,
    id_municipio: str,
    params: FinancialParams,
    alavancas: Alavancas,
    budget: float,
    objetivo: str = "equilibrado",
    max_payback: float = 10.0,
) -> dict:
    """
    Por que o município entrou ou ficou fora do plano e quanto custaria incluí-lo.

    Mesma regra de web/src/utils/plano.ts e da simulação "O que mudaria para incluir?" da ficha.
    `fin` é o recorte do cenário com o business case calculado (_capex, _payback, _npv).
    """
    linha = fin[fin["id_municipio"].astype(str) == id_municipio]
    if linha.empty:
        return {"status": "fora_escopo"}
    capex_mun = round(float(linha["_capex"].iloc[0]), 2)
    pb = float(linha["_payback"].iloc[0])

    base = optimize_portfolio(
        fin, params, alavancas, budget, max_payback=max_payback, objetivo_modo=objetivo
    )
    ids_base = base.municipios["id_municipio"].astype(str)
    if (ids_base == id_municipio).any():
        pct = round(100 * capex_mun / budget)
        return {"status": "selecionado", "capex_mi": capex_mun, "pct_orcamento": pct}

    if not math.isfinite(pb) or pb > max_payback:
        todas = alavancas.model_copy(
            update={
                "backhaul_comprometido": True, "fust_reembolsavel": True, "receita_escolar": True,
            }
        )
        pb_todas = float(add_financials(linha, params, todas)["_payback"].iloc[0])
        return {
            "status": "acima_teto",
            "payback_anos": round(pb, 2) if math.isfinite(pb) else None,
            "teto_payback_anos": max_payback,
            "payback_com_todas_alavancas": round(pb_todas, 2) if math.isfinite(pb_todas) else None,
            "entra_com_todas_alavancas": math.isfinite(pb_todas) and pb_todas <= max_payback,
        }

    sim = optimize_portfolio(
        fin, params, alavancas, budget, max_payback=max_payback, objetivo_modo=objetivo,
        incluir=[id_municipio],
    )
    if sim.status == "Infeasible":
        return {"status": "nao_cabe", "capex_mi": capex_mun, "orcamento_mi": budget}
    novos = set(sim.municipios["id_municipio"].astype(str))
    saem = base.municipios.loc[~ids_base.isin(novos), "nome"].tolist()
    livre = max(0.0, budget - base.capex_total)
    return {
        "status": "sem_espaco" if capex_mun > livre else "preterido",
        "capex_mi": capex_mun,
        "sobra_orcamento_mi": round(livre, 2),
        "objetivo": objetivo,
        "para_incluir": {
            "saem": saem[:5],
            "n_saem": len(saem),
            "delta_alunos": alunos_atendidos(sim.municipios) - alunos_atendidos(base.municipios),
            "delta_vpl_mi": round(
                float(sim.municipios["_npv"].sum() - base.municipios["_npv"].sum()), 2
            ),
            "delta_capex_mi": round(sim.capex_total - base.capex_total, 2),
        },
    }


def orcamento_minimo(
    fin: pd.DataFrame,
    params: FinancialParams,
    alavancas: Alavancas,
    meta_alunos: int,
    max_payback: float = 10.0,
    passo: int = 5,
    teto: int = 500,
) -> dict:
    """
    Menor orçamento, nos degraus do slider do painel (de `passo` em `passo` até `teto`), cujo
    portfólio com objetivo "alunos" atende ao menos `meta_alunos` alunos em escolas sem internet.

    Busca binária sobre os degraus (o objetivo "alunos" maximiza a soma de alunos, que só cresce
    com o orçamento); os números devolvidos são os da execução final do otimizador.
    """
    def rodar(degrau: int) -> PortfolioResult:
        return optimize_portfolio(
            fin, params, alavancas, degrau * passo, max_payback=max_payback, objetivo_modo="alunos"
        )

    hi = teto // passo
    melhor = rodar(hi)
    if alunos_atendidos(melhor.municipios) < meta_alunos:
        return {
            "atingivel": False,
            "meta_alunos": meta_alunos,
            "teto_orcamento_mi": teto,
            "max_alunos_no_teto": alunos_atendidos(melhor.municipios),
            "n_municipios_no_teto": melhor.n_selecionados,
        }
    lo = 1
    while lo < hi:  # invariante: o degrau `hi` atinge a meta e `melhor` é o resultado dele
        meio = (lo + hi) // 2
        r = rodar(meio)
        if alunos_atendidos(r.municipios) >= meta_alunos:
            hi, melhor = meio, r
        else:
            lo = meio + 1
    return {
        "atingivel": True,
        "meta_alunos": meta_alunos,
        "orcamento_mi": hi * passo,
        "alunos": alunos_atendidos(melhor.municipios),
        "n_municipios": melhor.n_selecionados,
        "capex_total_mi": round(melhor.capex_total, 2),
        "vpl_total_mi": round(float(melhor.municipios["_npv"].sum()), 2),
    }
