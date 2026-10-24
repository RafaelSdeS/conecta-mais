"""GET /backtest — resultado do backtest 2021→2025 (pré-calculado)."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["backtest"])


@router.get("/backtest")
def get_backtest():
    """
    Retorna o resultado do backtest 2021→2025.
    Placeholder até a ST8 ser implementada — retorna estrutura esperada com status.
    """
    return {
        "status": "pending",
        "message": "Backtest será implementado na ST8. Aguardando dados históricos.",
        "precision": None,
        "recall": None,
        "total_q1_q2_2021": None,
        "total_cresceram": None,
        "acertados": None,
    }
