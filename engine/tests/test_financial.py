"""
Testes da ferramenta financeira.

O caso central reproduz a simulação ilustrativa de §4.3 da proposta:
  Município: 4.800 domicílios urbanos, 12 escolas, backhaul a 40 km
  Premissas: custo_hp=477, custo_backhaul_km=61.800, custo_ativacao=500,
             adesao_pct=0.25, arpu_mensal=87.70, margem_ebitda=0.40

Resultados esperados (da tabela §4.3):
  A — Sem alavancas:          CapEx ~5,36 mi  | payback ~10,6 anos
  B — Backhaul comprometido:  CapEx ~2,89 mi  | payback ~5,7 anos
  C — B + receita escolar:    CapEx ~2,89 mi  | payback ~5,0 anos
"""

import pytest

from conecta.financial.calculator import (
    business_case,
    capex,
    npv,
    payback,
    sensitivity,
)
from conecta.financial.models import Alavancas, FinancialParams

# ── Município hipotético de §4.3 ─────────────────────────────────────────────
DOM = 4_800          # domicílios urbanos (homes passed)
DIST_KM = 40.0       # distância ao backhaul mais próximo
NUM_ESCOLAS = 12

PARAMS = FinancialParams(
    custo_hp=477.0,
    custo_backhaul_km=61_800.0,
    custo_ativacao=500.0,
    adesao_pct=0.25,
    arpu_mensal=87.70,
    margem_ebitda=0.40,
    wacc=0.15,
    wacc_fust=0.0325,
    anos_projeto=10,
    aliquota_imposto=0.34,
)

SEM_ALAVANCAS = Alavancas(
    backhaul_comprometido=False,
    fust_reembolsavel=False,
    receita_escolar=False,
    num_escolas=NUM_ESCOLAS,
)

COM_BACKHAUL = Alavancas(
    backhaul_comprometido=True,
    fust_reembolsavel=False,
    receita_escolar=False,
    num_escolas=NUM_ESCOLAS,
)

COM_BACKHAUL_E_ESCOLAS = Alavancas(
    backhaul_comprometido=True,
    fust_reembolsavel=False,
    receita_escolar=True,
    num_escolas=NUM_ESCOLAS,
)


# ── CapEx ─────────────────────────────────────────────────────────────────────

def test_capex_cenario_A():
    """§4.3 Cenário A: sem alavancas, CapEx ~5,36 mi."""
    cx = capex(DOM, DIST_KM, PARAMS, SEM_ALAVANCAS)
    assert cx.acesso   == pytest.approx(2.2896, abs=0.001)
    assert cx.backhaul == pytest.approx(2.472,  abs=0.01)
    assert cx.ativacao == pytest.approx(0.60,   abs=0.01)
    assert cx.total    == pytest.approx(5.36,   abs=0.05)


def test_capex_cenario_B():
    """§4.3 Cenário B: backhaul comprometido, CapEx ~2,89 mi."""
    cx = capex(DOM, DIST_KM, PARAMS, COM_BACKHAUL)
    assert cx.backhaul == pytest.approx(0.0,   abs=1e-9)
    assert cx.total    == pytest.approx(2.89,  abs=0.05)


def test_capex_cenario_C():
    """§4.3 Cenário C: mesmo CapEx que B (a receita escolar não afeta CapEx)."""
    cx_b = capex(DOM, DIST_KM, PARAMS, COM_BACKHAUL)
    cx_c = capex(DOM, DIST_KM, PARAMS, COM_BACKHAUL_E_ESCOLAS)
    assert cx_b.total == pytest.approx(cx_c.total, abs=1e-9)


# ── Payback ───────────────────────────────────────────────────────────────────

def test_payback_cenario_A():
    """§4.3 Cenário A: payback ~10,6 anos."""
    pb = payback(DOM, DIST_KM, PARAMS, SEM_ALAVANCAS)
    assert pb == pytest.approx(10.6, abs=0.2)


def test_payback_cenario_B():
    """§4.3 Cenário B: payback ~5,7 anos."""
    pb = payback(DOM, DIST_KM, PARAMS, COM_BACKHAUL)
    assert pb == pytest.approx(5.7, abs=0.2)


def test_payback_cenario_C():
    """§4.3 Cenário C: payback ~5,0 anos."""
    pb = payback(DOM, DIST_KM, PARAMS, COM_BACKHAUL_E_ESCOLAS)
    assert pb == pytest.approx(5.0, abs=0.2)


def test_payback_B_menor_que_A():
    pb_a = payback(DOM, DIST_KM, PARAMS, SEM_ALAVANCAS)
    pb_b = payback(DOM, DIST_KM, PARAMS, COM_BACKHAUL)
    assert pb_b < pb_a


def test_payback_C_menor_que_B():
    pb_b = payback(DOM, DIST_KM, PARAMS, COM_BACKHAUL)
    pb_c = payback(DOM, DIST_KM, PARAMS, COM_BACKHAUL_E_ESCOLAS)
    assert pb_c < pb_b


# ── Sensibilidade (tabela §4.3) ────────────────────────────────────────────────

@pytest.mark.parametrize("adesao,pb_A,pb_B,pb_C", [
    (0.15, 16.9, 8.7, 7.1),
    (0.25, 10.6, 5.7, 5.0),
    (0.35,  7.9, 4.4, 4.0),
])
def test_sensitivity_tabela_proposta(adesao, pb_A, pb_B, pb_C):
    """Reproduz a tabela de sensibilidade de §4.3 com tolerância ±0.3 anos."""
    tol = 0.3
    p = PARAMS.model_copy(update={"adesao_pct": adesao})
    assert payback(DOM, DIST_KM, p, SEM_ALAVANCAS)       == pytest.approx(pb_A, abs=tol)
    assert payback(DOM, DIST_KM, p, COM_BACKHAUL)         == pytest.approx(pb_B, abs=tol)
    assert payback(DOM, DIST_KM, p, COM_BACKHAUL_E_ESCOLAS) == pytest.approx(pb_C, abs=tol)


def test_sensitivity_retorna_tres_linhas():
    rows = sensitivity(DOM, DIST_KM, PARAMS, SEM_ALAVANCAS)
    assert len(rows) == 3
    assert [r["adesao_pct"] for r in rows] == [0.15, 0.25, 0.35]


# ── VPL ───────────────────────────────────────────────────────────────────────

def test_npv_fust_maior_que_sem_fust():
    """FUST reduz o custo de capital → VPL com FUST > VPL sem FUST."""
    alav_fust = SEM_ALAVANCAS.model_copy(update={"fust_reembolsavel": True})
    vpl_sem = npv(DOM, DIST_KM, PARAMS, SEM_ALAVANCAS)
    vpl_com = npv(DOM, DIST_KM, PARAMS, alav_fust)
    assert vpl_com > vpl_sem


def test_npv_backhaul_comprometido_maior():
    """CapEx menor → VPL maior."""
    vpl_a = npv(DOM, DIST_KM, PARAMS, SEM_ALAVANCAS)
    vpl_b = npv(DOM, DIST_KM, PARAMS, COM_BACKHAUL)
    assert vpl_b > vpl_a


# ── Business case completo ────────────────────────────────────────────────────

def test_business_case_estrutura():
    result = business_case("1234567", DOM, DIST_KM, NUM_ESCOLAS, PARAMS, SEM_ALAVANCAS)
    assert result.id_municipio == "1234567"
    assert result.capex.total > 0
    assert result.payback_anos > 0
    assert len(result.sensitivity) == 3


def test_business_case_payback_consistente():
    """O payback do business_case deve ser igual ao payback() direto."""
    bc = business_case("1234567", DOM, DIST_KM, NUM_ESCOLAS, PARAMS, SEM_ALAVANCAS)
    pb = payback(DOM, DIST_KM, PARAMS, SEM_ALAVANCAS)
    assert bc.payback_anos == pytest.approx(pb, abs=1e-9)
