"""POST /financial — business case de um município."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from conecta.financial.calculator import business_case
from conecta.financial.models import Alavancas, FinancialParams

router = APIRouter(tags=["financial"])


class FinancialRequest(BaseModel):
    id_municipio: str
    params: FinancialParams = FinancialParams()
    alavancas: Alavancas = Alavancas()


@router.post("/financial")
def post_financial(body: FinancialRequest, request: Request):
    """
    Calcula o business case completo de um município:
    CapEx, payback, VPL e sensibilidade à adesão.
    """
    df = request.app.state.municipios
    row = df[df["id_municipio"].astype(str) == str(body.id_municipio)]

    if row.empty:
        raise HTTPException(status_code=404, detail=f"Município {body.id_municipio!r} não encontrado.")

    m = row.iloc[0]

    # Sobrescrever backhaul_comprometido com o acordo real do município
    alavancas = body.alavancas.model_copy(
        update={"backhaul_comprometido": bool(m.get("acordo_migracao", False))}
    )

    result = business_case(
        id_municipio=str(body.id_municipio),
        domicilios_urbanos=int(m["domicilios_urbanos"]),
        dist_backhaul_km=float(m.get("dist_backhaul_km") or 0.0),
        num_escolas=int(m.get("eace_escolas", 0)),
        params=body.params,
        alavancas=alavancas,
    )
    return result.model_dump()
