"""
Ferramenta financeira do Conecta+.

Calcula CapEx, payback simples, VPL e sensibilidade à adesão para um
município, com e sem alavancas. Os defaults reproduzem a simulação
ilustrativa da proposta (§4.3).

Notas de implementação:
- Payback usa EBITDA sem descontar impostos (payback simples contábil),
  consistente com a tabela de §4.3.
- VPL usa NOPAT = EBITDA × (1 - alíquota), pois o EBITDA não é fluxo
  de caixa. Inclui rampa de adesão nos três primeiros anos.
- Efeito do FUST: troca o WACC pela taxa subsidiada no cálculo do VPL.
  Não altera o payback simples.
- Receita escolar: somada à receita residencial se `receita_escolar=True`.
"""

from __future__ import annotations

import numpy as np

from conecta.financial.models import (
    Alavancas,
    CapexResult,
    FinancialParams,
    FinancialResult,
)

# Rampa de adesão: anos 1-3 crescem progressivamente até a maturidade
_RAMPA = [0.40, 0.70, 1.00]  # frações da adesão de maturidade


def capex(
    domicilios_urbanos: int,
    dist_backhaul_km: float,
    params: FinancialParams,
    alavancas: Alavancas,
) -> CapexResult:
    """
    Calcula o CapEx incremental em R$ milhões.

    Args:
        domicilios_urbanos: Número de homes passed estimados.
        dist_backhaul_km:   Distância ao backhaul mais próximo (km).
        params:             Premissas financeiras.
        alavancas:          Alavancas ativas.

    Returns:
        CapexResult com acesso, backhaul e ativação em R$ mi.
    """
    clientes = domicilios_urbanos * params.adesao_pct

    acesso_rs = domicilios_urbanos * params.custo_hp
    backhaul_rs = (
        0.0
        if alavancas.backhaul_comprometido
        else dist_backhaul_km * params.custo_backhaul_km
    )
    ativacao_rs = clientes * params.custo_ativacao

    # Converter para R$ milhões
    acesso_mi   = acesso_rs   / 1_000_000
    backhaul_mi = backhaul_rs / 1_000_000
    ativacao_mi = ativacao_rs / 1_000_000

    return CapexResult(
        acesso=round(acesso_mi, 4),
        backhaul=round(backhaul_mi, 4),
        ativacao=round(ativacao_mi, 4),
        total=round(acesso_mi + backhaul_mi + ativacao_mi, 4),
    )


def _receita_anual_maturidade(
    domicilios_urbanos: int,
    params: FinancialParams,
    alavancas: Alavancas,
) -> float:
    """Receita anual em maturidade (R$ mi), residencial + escolar se aplicável."""
    clientes = domicilios_urbanos * params.adesao_pct
    b2c = clientes * params.arpu_mensal * 12 / 1_000_000
    b2g = (
        alavancas.num_escolas * alavancas.arpu_escolar_mensal * 12 / 1_000_000
        if alavancas.receita_escolar
        else 0.0
    )
    return b2c + b2g


def payback(
    domicilios_urbanos: int,
    dist_backhaul_km: float,
    params: FinancialParams,
    alavancas: Alavancas,
) -> float:
    """
    Payback simples (anos) = CapEx total / EBITDA anual em maturidade.

    Consistente com a tabela de §4.3 (sem desconto de impostos, sem rampa).
    Retorna float('inf') se EBITDA for zero ou negativo.
    """
    cx = capex(domicilios_urbanos, dist_backhaul_km, params, alavancas)
    receita = _receita_anual_maturidade(domicilios_urbanos, params, alavancas)
    ebitda = receita * params.margem_ebitda

    if ebitda <= 0:
        return float("inf")

    return round(cx.total / ebitda, 2)


def npv(
    domicilios_urbanos: int,
    dist_backhaul_km: float,
    params: FinancialParams,
    alavancas: Alavancas,
) -> float:
    """
    VPL do projeto em R$ milhões.

    Fluxo de caixa = NOPAT = EBITDA × (1 - alíquota_imposto).
    Com rampa de adesão nos três primeiros anos.
    Efeito do FUST: substitui wacc por wacc_fust na taxa de desconto.
    """
    cx = capex(domicilios_urbanos, dist_backhaul_km, params, alavancas)
    receita_mat = _receita_anual_maturidade(domicilios_urbanos, params, alavancas)
    ebitda_mat = receita_mat * params.margem_ebitda
    nopat_mat = ebitda_mat * (1 - params.aliquota_imposto)

    taxa = params.wacc_fust if alavancas.fust_reembolsavel else params.wacc

    # Fluxo por ano com rampa nos primeiros len(_RAMPA) anos
    anos = params.anos_projeto
    fluxos = np.array([
        nopat_mat * (_RAMPA[t] if t < len(_RAMPA) else 1.0)
        for t in range(anos)
    ])

    # Fator de desconto: 1/(1+r)^(t+1) para t = 0..anos-1
    fatores = 1.0 / (1.0 + taxa) ** np.arange(1, anos + 1)

    vpl = float(np.dot(fluxos, fatores)) - cx.total
    return round(vpl, 4)


def sensitivity(
    domicilios_urbanos: int,
    dist_backhaul_km: float,
    params: FinancialParams,
    alavancas: Alavancas,
    adesoes: list[float] | None = None,
) -> list[dict]:
    """
    Tabela de sensibilidade do payback à taxa de adesão.

    Args:
        adesoes: Lista de taxas de adesão a testar. Default: [0.15, 0.25, 0.35].

    Returns:
        Lista de dicts [{adesao_pct, payback_anos}, ...].
    """
    if adesoes is None:
        adesoes = [0.15, 0.25, 0.35]

    resultados = []
    for a in adesoes:
        p_var = params.model_copy(update={"adesao_pct": a})
        pb = payback(domicilios_urbanos, dist_backhaul_km, p_var, alavancas)
        resultados.append({"adesao_pct": a, "payback_anos": pb})

    return resultados


def business_case(
    id_municipio: str,
    domicilios_urbanos: int,
    dist_backhaul_km: float,
    num_escolas: int,
    params: FinancialParams,
    alavancas: Alavancas,
) -> FinancialResult:
    """
    Business case completo de um município.

    Combina capex(), payback(), npv() e sensitivity() em um único resultado.
    """
    alav = alavancas.model_copy(update={"num_escolas": num_escolas})

    cx = capex(domicilios_urbanos, dist_backhaul_km, params, alav)
    receita = _receita_anual_maturidade(domicilios_urbanos, params, alav)
    ebitda = receita * params.margem_ebitda
    pb = payback(domicilios_urbanos, dist_backhaul_km, params, alav)
    vpl = npv(domicilios_urbanos, dist_backhaul_km, params, alav)
    sens = sensitivity(domicilios_urbanos, dist_backhaul_km, params, alav)

    return FinancialResult(
        id_municipio=id_municipio,
        capex=cx,
        receita_anual=round(receita, 4),
        ebitda_anual=round(ebitda, 4),
        payback_anos=pb,
        npv=vpl,
        sensitivity=sens,
    )
