"""POST /portfolio — otimiza portfólio por orçamento."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from api.utils import df_to_records

from conecta.financial.models import Alavancas, FinancialParams
from conecta.optimizer.portfolio import optimize_portfolio
from conecta.scores.models import ScoreWeights

router = APIRouter(tags=["portfolio"])


class PortfolioRequest(BaseModel):
    budget: float = Field(..., gt=0, description="Orçamento de CapEx (R$ mi)")
    lambda_: float = Field(0.5, ge=0.0, le=1.0, description="Peso impacto (1) vs retorno (0)")
    max_payback: float = Field(10.0, gt=0, description="Payback máximo aceito (anos)")
    uf: Optional[str] = Field(None, description="Filtrar por UF antes de otimizar")
    alavancas: Alavancas = Alavancas()
    params: FinancialParams = FinancialParams()
    weights: ScoreWeights = ScoreWeights()


@router.post("/portfolio")
def post_portfolio(body: PortfolioRequest, request: Request):
    """
    Seleciona o portfólio ótimo de municípios dado um orçamento.
    Formulação MILP: max Σ [λ·Î + (1-λ)·VPL̂] s.a. Σ CapEx ≤ budget.
    """
    df = request.app.state.municipios.copy()

    if body.uf:
        df = df[df["uf"].str.upper() == body.uf.upper()]

    result = optimize_portfolio(
        municipios_df=df,
        params=body.params,
        alavancas=body.alavancas,
        budget=body.budget,
        lambda_=body.lambda_,
        max_payback=body.max_payback,
        weights=body.weights,
    )

    return {
        "municipios": df_to_records(result.municipios),
        "capex_total": result.capex_total,
        "payback_medio": result.payback_medio,
        "score_total": result.score_total,
        "status": result.status,
        "n_candidatos": result.n_candidatos,
        "n_selecionados": result.n_selecionados,
    }
