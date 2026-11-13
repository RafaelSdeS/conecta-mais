"""Tecnologia de acesso (FTTH × FWA 5G × satélite): recomendação por regra e comparação de custos.

FTTH usa as premissas principais (da proposta). FWA e satélite usam premissas ILUSTRATIVAS de
FinancialParams (fwa_*, sat_*). Reaproveita capex(), payback() e npv().
"""

from __future__ import annotations

from conecta.financial.calculator import capex, npv, payback
from conecta.financial.models import Alavancas, FinancialParams

_EPS = 0.01  # os campos de custo exigem > 0; satélite não tem rede nem backhaul

# Regra de recomendação da proposta (§10): FTTH em áreas urbanas densas, FWA nas periferias e satélite
# em áreas isoladas. Limiares ilustrativos, a validar com a engenharia da operadora.
ISOLADO_KM = 45.0            # longe do backhaul
SATELITE_MAX_DOMICILIOS = 3_000
FWA_MAX_DOMICILIOS = 15_000


def recomendar_tecnologia(domicilios_urbanos: int, dist_backhaul_km: float) -> tuple[str, str]:
    """Tecnologia recomendada e a regra que a escolheu."""
    if dist_backhaul_km > ISOLADO_KM and domicilios_urbanos < SATELITE_MAX_DOMICILIOS:
        return "Satélite", f"isolado (> {ISOLADO_KM:.0f} km do backhaul) e poucos domicílios (< {SATELITE_MAX_DOMICILIOS:,})".replace(",", ".")
    if dist_backhaul_km > ISOLADO_KM and domicilios_urbanos < FWA_MAX_DOMICILIOS:
        return "FWA 5G", f"afastado do backhaul (> {ISOLADO_KM:.0f} km) e porte médio-baixo (< {FWA_MAX_DOMICILIOS:,} domicílios)".replace(",", ".")
    return "FTTH", "área com escala ou próxima do backhaul: fibra até o domicílio"


def comparar_tecnologias(
    domicilios_urbanos: int,
    dist_backhaul_km: float,
    params: FinancialParams,
    alavancas: Alavancas,
) -> dict:
    """CapEx, payback e VPL de cada tecnologia (estimativa ilustrativa) e a recomendada pela regra."""
    casos = {
        "FTTH": (params, dist_backhaul_km),
        "FWA 5G": (
            params.model_copy(update={
                "custo_hp": params.fwa_custo_hp, "custo_ativacao": params.fwa_custo_cpe,
                "arpu_mensal": params.fwa_arpu, "margem_ebitda": params.fwa_margem,
            }),
            dist_backhaul_km,
        ),
        "Satélite": (
            params.model_copy(update={
                "custo_hp": _EPS, "custo_backhaul_km": _EPS, "custo_ativacao": params.sat_custo_terminal,
                "arpu_mensal": params.sat_arpu, "margem_ebitda": params.sat_margem,
            }),
            0.0,
        ),
    }
    linhas = []
    for nome, (p, dist) in casos.items():
        alav = alavancas if nome == "FTTH" else alavancas.model_copy(update={"backhaul_comprometido": False})
        pb = payback(domicilios_urbanos, dist, p, alav)
        linhas.append({
            "tecnologia": nome,
            "capex_mi": capex(domicilios_urbanos, dist, p, alav).total,
            "payback_anos": None if pb == float("inf") else pb,
            "vpl_mi": npv(domicilios_urbanos, dist, p, alav),
        })
    recomendada, regra = recomendar_tecnologia(domicilios_urbanos, dist_backhaul_km)
    return {
        "tecnologias": linhas,
        "tecnologia_recomendada": recomendada,
        "regra": regra,
        "aviso": "Custos de FWA e satélite são premissas ilustrativas, sem fonte pública; a recomendação segue a regra da proposta.",
    }
