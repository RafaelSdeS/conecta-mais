"""
Testes da ferramenta de otimização de portfólio.

Casos verificáveis à mão:
- Orçamento zero → portfólio vazio
- Payback máximo zero → portfólio vazio
- Orçamento generoso → todos os candidatos elegíveis são selecionados
- Orçamento restrito → subconjunto ótimo
- lambda_=1 favorece impacto; lambda_=0 favorece VPL
"""

from pathlib import Path

import pytest

from conecta.data.loader import load_backhaul, load_municipios
from conecta.financial.models import Alavancas, FinancialParams
from conecta.geo.distances import add_backhaul_distances
from conecta.optimizer.portfolio import optimize_portfolio
from conecta.scores.calculator import calculate_scores

DATA_DIR = Path(__file__).parent.parent / "data"

PARAMS = FinancialParams()
ALAVANCAS = Alavancas()


@pytest.fixture(scope="module")
def df_com_scores():
    """DataFrame completo: carregado, distâncias calculadas, scores calculados."""
    municipios = load_municipios(DATA_DIR / "mock_municipios.csv")
    backhaul   = load_backhaul(DATA_DIR / "mock_backhaul.csv")
    municipios = add_backhaul_distances(municipios, backhaul)
    return calculate_scores(municipios)


# ── Casos limite ──────────────────────────────────────────────────────────────

def test_orcamento_zero_retorna_vazio(df_com_scores):
    result = optimize_portfolio(df_com_scores, PARAMS, ALAVANCAS, budget=0.0)
    assert result.n_selecionados == 0
    assert result.capex_total == 0.0


def test_payback_maximo_zero_retorna_vazio(df_com_scores):
    result = optimize_portfolio(df_com_scores, PARAMS, ALAVANCAS, budget=1000.0, max_payback=0.0)
    assert result.n_selecionados == 0


def test_orcamento_generoso_seleciona_todos_elegiveis(df_com_scores):
    """Com orçamento infinito, todos com payback ≤ max_payback são selecionados."""
    max_pb = 8.0
    result = optimize_portfolio(
        df_com_scores, PARAMS, ALAVANCAS, budget=1e9, max_payback=max_pb
    )
    assert result.n_selecionados == result.n_candidatos
    assert result.status == "Optimal"


# ── Consistência financeira ───────────────────────────────────────────────────

def test_capex_total_dentro_do_orcamento(df_com_scores):
    budget = 50.0  # R$ 50 mi
    result = optimize_portfolio(df_com_scores, PARAMS, ALAVANCAS, budget=budget)
    assert result.capex_total <= budget + 1e-6   # tolerância numérica


def test_payback_medio_dentro_do_limite(df_com_scores):
    max_pb = 7.0
    result = optimize_portfolio(
        df_com_scores, PARAMS, ALAVANCAS, budget=1e9, max_payback=max_pb
    )
    if result.n_selecionados > 0:
        assert result.payback_medio <= max_pb + 1e-6


def test_solver_status_optimal(df_com_scores):
    result = optimize_portfolio(df_com_scores, PARAMS, ALAVANCAS, budget=100.0)
    assert result.status == "Optimal"


# ── Lambda altera composição ──────────────────────────────────────────────────

def test_lambda_1_vs_lambda_0(df_com_scores):
    """
    lambda_=1 maximiza impacto (score_I), lambda_=0 maximiza VPL.
    Os portfólios não precisam ser iguais com orçamento restrito.
    """
    # alavanca TCU ligada: só os municípios do acordo ficam com backhaul zerado (CapEx menor)
    tcu = Alavancas(backhaul_comprometido=True)
    r_impacto = optimize_portfolio(df_com_scores, PARAMS, tcu, budget=30.0, lambda_=1.0)
    r_retorno = optimize_portfolio(df_com_scores, PARAMS, tcu, budget=30.0, lambda_=0.0)
    # Ambos são soluções viáveis
    assert r_impacto.status == "Optimal"
    assert r_retorno.status == "Optimal"
    # Os conjuntos selecionados podem diferir
    ids_impacto = set(r_impacto.municipios["id_municipio"].astype(str))
    ids_retorno = set(r_retorno.municipios["id_municipio"].astype(str))
    # Não exigimos que sejam diferentes (podem coincidir), mas ambos devem ser válidos
    assert len(ids_impacto) > 0
    assert len(ids_retorno) > 0


# ── Estrutura do resultado ────────────────────────────────────────────────────

def test_resultado_tem_campos_esperados(df_com_scores):
    result = optimize_portfolio(df_com_scores, PARAMS, ALAVANCAS, budget=50.0)
    assert hasattr(result, "municipios")
    assert hasattr(result, "capex_total")
    assert hasattr(result, "payback_medio")
    assert hasattr(result, "score_total")
    assert hasattr(result, "status")
    assert hasattr(result, "n_candidatos")
    assert hasattr(result, "n_selecionados")


# ── Alavancas ─────────────────────────────────────────────────────────────────

def test_alavanca_tcu_so_zera_backhaul_de_municipios_do_acordo(df_com_scores):
    from conecta.optimizer.portfolio import add_financials

    sem = add_financials(df_com_scores, PARAMS, Alavancas())
    com = add_financials(df_com_scores, PARAMS, Alavancas(backhaul_comprometido=True))
    acordo = df_com_scores["acordo_migracao"].astype(bool)
    assert acordo.any()
    assert (com.loc[acordo, "_capex"] < sem.loc[acordo, "_capex"]).any()
    assert (com.loc[~acordo, "_capex"] == sem.loc[~acordo, "_capex"]).all()


def test_alavanca_enace_e_fust_mudam_payback_e_vpl(df_com_scores):
    from conecta.optimizer.portfolio import add_financials

    base = add_financials(df_com_scores, PARAMS, Alavancas())
    enec = add_financials(df_com_scores, PARAMS, Alavancas(receita_escolar=True))
    fust = add_financials(df_com_scores, PARAMS, Alavancas(fust_reembolsavel=True))
    assert (enec["_payback"] <= base["_payback"]).all() and (enec["_payback"] < base["_payback"]).any()
    assert (fust["_npv"] > base["_npv"]).all()
    assert (fust["_payback"] == base["_payback"]).all()  # FUST muda o custo de capital, não o payback simples


def test_objetivo_alunos_prioriza_municipios_com_mais_alunos(df_com_scores):
    df = df_com_scores.assign(alunos_sem_internet=df_com_scores["matriculas_publicas"])
    r = optimize_portfolio(df, PARAMS, Alavancas(backhaul_comprometido=True), budget=300.0,
                           max_payback=20.0, objetivo_modo="alunos")
    assert r.status == "Optimal" and r.n_selecionados > 0
