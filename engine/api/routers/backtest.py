"""GET /backtest — resultado do backtest 2021→2025."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from conecta.backtest.runner import run_backtest
from conecta.data.loader import load_backhaul, load_municipios

router = APIRouter(tags=["backtest"])

DATA_DIR = Path(__file__).parent.parent.parent / "data"

# Pré-calcula ao importar o módulo (é chamado uma vez no lifespan da app)
_result = None


def _get_result():
    global _result
    if _result is None:
        data_2021 = load_municipios(DATA_DIR / "mock_backtest_2021.csv")
        data_2025 = load_municipios(DATA_DIR / "mock_municipios.csv")
        backhaul  = load_backhaul(DATA_DIR / "mock_backhaul.csv")
        _result   = run_backtest(data_2021, data_2025, backhaul)
    return _result


@router.get("/backtest")
def get_backtest():
    """
    Retorna o resultado do backtest 2021→2025.

    Precision: dos municípios que o modelo classificou Q1/Q2a em 2021,
               quantos realmente cresceram em fibra até 2025.
    Recall:    dos municípios que cresceram, quantos estavam em Q1/Q2a.
    """
    r = _get_result()
    return {
        "status": "ok",
        "precision": r.precision,
        "recall": r.recall,
        "f1": r.f1,
        "total_q1_q2a_2021": r.total_q1_q2a_2021,
        "total_cresceram": r.total_cresceram,
        "acertados": r.acertados,
        "threshold_crescimento": r.threshold_crescimento,
    }
