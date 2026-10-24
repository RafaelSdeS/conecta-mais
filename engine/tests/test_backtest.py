"""
Testes do backtest 2021 → 2025.
"""

from pathlib import Path

import pytest

from conecta.backtest.runner import run_backtest
from conecta.data.loader import load_backhaul, load_municipios

DATA_DIR = Path(__file__).parent.parent / "data"


@pytest.fixture(scope="module")
def data_2021():
    return load_municipios(DATA_DIR / "mock_backtest_2021.csv")


@pytest.fixture(scope="module")
def data_2025():
    return load_municipios(DATA_DIR / "mock_municipios.csv")


@pytest.fixture(scope="module")
def backhaul():
    return load_backhaul(DATA_DIR / "mock_backhaul.csv")


def test_backtest_roda_sem_erros(data_2021, data_2025, backhaul):
    result = run_backtest(data_2021, data_2025, backhaul)
    assert result is not None


def test_precision_entre_0_e_1(data_2021, data_2025, backhaul):
    result = run_backtest(data_2021, data_2025, backhaul)
    assert 0.0 <= result.precision <= 1.0


def test_recall_entre_0_e_1(data_2021, data_2025, backhaul):
    result = run_backtest(data_2021, data_2025, backhaul)
    assert 0.0 <= result.recall <= 1.0


def test_f1_entre_0_e_1(data_2021, data_2025, backhaul):
    result = run_backtest(data_2021, data_2025, backhaul)
    assert 0.0 <= result.f1 <= 1.0


def test_acertados_nao_excede_positivos(data_2021, data_2025, backhaul):
    result = run_backtest(data_2021, data_2025, backhaul)
    assert result.acertados <= result.total_q1_q2a_2021
    assert result.acertados <= result.total_cresceram


def test_detalhes_tem_todos_os_municipios(data_2021, data_2025, backhaul):
    result = run_backtest(data_2021, data_2025, backhaul)
    assert len(result.detalhes) == len(data_2021)


def test_threshold_maior_reduz_crescimento(data_2021, data_2025, backhaul):
    """Threshold mais alto → menos municípios classificados como 'cresceram'."""
    r_baixo = run_backtest(data_2021, data_2025, backhaul, threshold_crescimento=1.1)
    r_alto  = run_backtest(data_2021, data_2025, backhaul, threshold_crescimento=2.0)
    assert r_alto.total_cresceram <= r_baixo.total_cresceram


def test_modelo_tem_alguma_precisao(data_2021, data_2025, backhaul):
    """
    Com dados sintéticos consistentes (cidades grandes têm mais fibra em 2025),
    o modelo deve ter precision > 0.
    """
    result = run_backtest(data_2021, data_2025, backhaul)
    assert result.precision > 0.0
    assert result.recall > 0.0
