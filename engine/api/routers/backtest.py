"""GET /backtest — backtest 2021→hoje do modelo de scores.

Com a base real e o histórico da Anatel (tabela bl_2021), usa fibra de dezembro de 2021 contra o
último mês publicado; senão, cai nos CSVs demonstrativos (49 municípios).
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

from conecta.backtest.runner import run_backtest
from conecta.data.loader import load_backhaul, load_municipios

router = APIRouter(tags=["backtest"])

DATA_DIR = Path(__file__).parent.parent.parent / "data"
LIMIARES_REAL = (1.2, 1.5, 2.0, 3.0)
LIMIAR_PRINCIPAL_REAL = 2.0  # a base de fibra dobrou; 20% é quase universal e não discrimina

_DESCRICAO_REAL = (
    "Fibra e banda larga fixa de pessoa física (Anatel): dezembro de 2021 contra o último mês publicado. "
    "Os scores de 2021 usam o acesso de 2021 e os demais indicadores atuais (INEP 2024, Censo 2022, backhaul "
    "atual), então é um backtest parcial: indicadores atuais podem antecipar parte do crescimento."
)
_DESCRICAO_MOCK = "Dados demonstrativos (49 municípios): não há base histórica real carregada."


def _real(request: Request):
    atual = request.app.state.municipios
    antigo = request.app.state.bl_2021
    d25 = atual.copy()
    d21 = atual.copy()
    for col in ("acessos_fibra", "acessos_total_bl"):
        d21[col] = d21["id_municipio"].map(antigo.set_index("id_municipio")[col]).fillna(0).astype(int)
    backhaul = atual.loc[atual["tem_backhaul_fibra"], ["id_municipio", "lat", "lon"]]
    return d21, d25, backhaul


def _calcula(request: Request) -> dict:
    if request.app.state.fonte_dados == "real" and request.app.state.bl_2021 is not None:
        d21, d25, backhaul = _real(request)
        fonte, descricao, limiar = "real", _DESCRICAO_REAL, LIMIAR_PRINCIPAL_REAL
        limiares = LIMIARES_REAL
    else:
        d21 = load_municipios(DATA_DIR / "mock_backtest_2021.csv")
        d25 = load_municipios(DATA_DIR / "mock_municipios.csv")
        backhaul = load_backhaul(DATA_DIR / "mock_backhaul.csv")
        fonte, descricao, limiar, limiares = "demonstrativo", _DESCRICAO_MOCK, 1.2, (1.2,)

    por_limiar = {t: run_backtest(d21, d25, backhaul, threshold_crescimento=t) for t in limiares}
    r = por_limiar[limiar]
    return {
        "status": "ok",
        "fonte": fonte,
        "descricao": descricao,
        "precision": r.precision,
        "recall": r.recall,
        "f1": r.f1,
        "total_q1_q2a_2021": r.total_q1_q2a_2021,
        "total_cresceram": r.total_cresceram,
        "acertados": r.acertados,
        "threshold_crescimento": r.threshold_crescimento,
        "taxa_base": r.taxa_base,
        "lift": r.lift,
        "limiares": [
            {
                "limiar": t, "precision": x.precision, "recall": x.recall, "f1": x.f1,
                "cresceram": x.total_cresceram, "taxa_base": x.taxa_base, "lift": x.lift,
            }
            for t, x in por_limiar.items()
        ],
    }


@router.get("/backtest")
def get_backtest(request: Request):
    """
    Precision: dos municípios que o modelo classificou Q1/Q2a em 2021, quantos cresceram em fibra.
    Recall:    dos que cresceram, quantos estavam em Q1/Q2a.
    Lift:      precision ÷ taxa-base (fração de todos os municípios que cresceram); 1,0 = acaso.
    """
    cache = request.app.state.__dict__.setdefault("cache_backtest", {})
    if "r" not in cache:
        cache["r"] = _calcula(request)
    return cache["r"]
