"""POST /scores — recalcula scores com pesos customizados."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api.utils import df_to_records

from conecta.scores.calculator import calculate_scores
from conecta.scores.models import ScoreWeights

router = APIRouter(tags=["scores"])


class ScoresRequest(BaseModel):
    weights: ScoreWeights


@router.post("/scores")
def post_scores(body: ScoresRequest, request: Request):
    """
    Recalcula os scores M, I, C, A e quadrantes com pesos customizados.
    Retorna a lista completa de municípios com os novos scores.
    """
    df = request.app.state.municipios.copy()

    # Remover colunas de score anteriores para recalcular
    score_cols = ["score_M", "score_I", "score_C", "score_A", "score_total", "quadrante", "deficit_banda_mbps"]
    df = df.drop(columns=[c for c in score_cols if c in df.columns])

    df = calculate_scores(df, weights=body.weights)
    return df_to_records(df)
