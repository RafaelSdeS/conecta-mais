"""GET /municipios — lista com scores, filtros por uf e quadrante."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Request

from api.utils import df_to_records

router = APIRouter(tags=["municipios"])


@router.get("/municipios")
def get_municipios(
    request: Request,
    uf: Optional[str] = Query(None, description="Filtrar por UF (ex: SP, BA)"),
    quadrante: Optional[str] = Query(None, description="Filtrar por quadrante (Q1, Q2a, Q2b, Q3, Q4)"),
):
    """
    Retorna todos os municípios com scores calculados.
    Aceita filtros opcionais por UF e quadrante.
    """
    df = request.app.state.municipios.copy()

    if uf:
        df = df[df["uf"].str.upper() == uf.upper()]
    if quadrante:
        df = df[df["quadrante"] == quadrante.upper()]

    return df_to_records(df)
