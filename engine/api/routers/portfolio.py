"""POST /portfolio — otimiza portfólio por orçamento e devolve o cenário calculado."""

from __future__ import annotations

from typing import Literal, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from api.utils import df_to_records
from conecta.data.escopo import Regiao, filtrar_escopo
from conecta.financial.models import Alavancas, FinancialParams
from conecta.optimizer.portfolio import add_financials, optimize_portfolio
from conecta.scores.models import ScoreWeights

router = APIRouter(tags=["portfolio"])

_MAX_CACHE = 16


class PortfolioRequest(BaseModel):
    budget: float = Field(..., gt=0, description="Orçamento de CapEx (R$ mi)")
    lambda_: float = Field(0.5, ge=0.0, le=1.0, description="Peso impacto (1) vs retorno (0)")
    max_payback: float = Field(10.0, gt=0, description="Payback máximo aceito (anos)")
    uf: Optional[str] = Field(None, description="Filtrar por UF antes de otimizar")
    semiarido: bool = Field(False, description="Só municípios do Semiárido")
    regiao: Optional[Regiao] = None
    objetivo: Literal["retorno", "equilibrado", "alunos"] = "equilibrado"
    alavancas: Alavancas = Alavancas()
    params: FinancialParams = FinancialParams()
    weights: ScoreWeights = ScoreWeights()


def financeiro_cenario(request: Request, params: FinancialParams, alavancas: Alavancas) -> pd.DataFrame:
    """Business case de todos os municípios; só depende de premissas e alavancas, então é memoizado."""
    cache = request.app.state.__dict__.setdefault("cache_financeiro", {})
    chave = (params.model_dump_json(), alavancas.model_dump_json())
    if chave not in cache:
        if len(cache) >= _MAX_CACHE:
            cache.pop(next(iter(cache)))  # ponytail: descarta o mais antigo; LRU se o uso crescer
        cache[chave] = add_financials(request.app.state.municipios, params, alavancas)
    return cache[chave]


def _resumo(sel: pd.DataFrame) -> dict:
    """Payback médio (ponderado pelo CapEx) e VPL total de um conjunto de municípios."""
    ok = np.isfinite(sel["_payback"]) & (sel["_capex"] > 0)
    payback = float(np.average(sel.loc[ok, "_payback"], weights=sel.loc[ok, "_capex"])) if ok.any() else 0.0
    return {"payback_medio": round(payback, 2), "vpl_total": round(float(sel["_npv"].sum()), 2)}


@router.post("/portfolio")
def post_portfolio(body: PortfolioRequest, request: Request):
    """
    Seleciona o portfólio ótimo de municípios dado um orçamento.
    Formulação MILP: max Σ [λ·Î + (1-λ)·VPL̂] s.a. Σ CapEx ≤ budget
    (objetivo "alunos" maximiza os alunos em escolas sem internet).
    """
    fin = filtrar_escopo(
        financeiro_cenario(request, body.params, body.alavancas), body.uf, body.semiarido, body.regiao
    )

    result = optimize_portfolio(
        municipios_df=fin,
        params=body.params,
        alavancas=body.alavancas,
        budget=body.budget,
        lambda_=body.lambda_,
        max_payback=body.max_payback,
        weights=body.weights,
        objetivo_modo=body.objetivo,
    )

    # Efeito das alavancas no mesmo conjunto de municípios: com × sem.
    sel_ids = result.municipios.index
    efeito = None
    if len(sel_ids):
        base = filtrar_escopo(
            financeiro_cenario(request, body.params, Alavancas()), body.uf, body.semiarido, body.regiao
        ).loc[sel_ids]
        efeito = {"com": _resumo(result.municipios), "sem": _resumo(base)}

    financeiro = [
        {
            "id_municipio": str(i),
            "capex": round(c, 3),
            "payback": round(p, 2) if np.isfinite(p) else None,
            "npv": round(n, 3),
        }
        for i, c, p, n in zip(fin["id_municipio"], fin["_capex"], fin["_payback"], fin["_npv"])
    ]

    return {
        "municipios": df_to_records(result.municipios.drop(columns=["_capex", "_payback", "_npv"])),
        "capex_total": result.capex_total,
        "payback_medio": result.payback_medio,
        "score_total": result.score_total,
        "status": result.status,
        "solver": result.solver,
        "n_candidatos": result.n_candidatos,
        "n_selecionados": result.n_selecionados,
        "alunos_atendidos": int(result.municipios.get("alunos_sem_internet", pd.Series(dtype=int)).sum()),
        "escolas_atendidas": int(
            result.municipios.get("escolas_sem_internet_aprendizagem", pd.Series(dtype=int)).sum()
        ),
        "vpl_total": round(float(result.municipios["_npv"].sum()), 2) if len(sel_ids) else 0.0,
        "efeito_alavancas": efeito,
        "financeiro": financeiro,
    }
