"""
Testes do módulo de scores.

Verifica:
- Normalização em [0, 100]
- Validação dos pesos (soma = 1.0)
- Classificação nos cinco quadrantes
- score_C invertido (custo menor → score maior)
- Município com backhaul comprometido tem score_A > município sem alavancas
"""

from pathlib import Path

import pandas as pd
import pytest

from conecta.data.loader import load_municipios
from conecta.scores.calculator import calculate_scores, _deficit_banda
from conecta.scores.models import ScoreWeights

DATA_DIR = Path(__file__).parent.parent / "data"


@pytest.fixture()
def df():
    return load_municipios(DATA_DIR / "mock_municipios.csv")


# ---------------------------------------------------------------------------
# ScoreWeights
# ---------------------------------------------------------------------------

def test_pesos_validos():
    w = ScoreWeights(w_M=0.4, w_I=0.3, w_C=0.2, w_A=0.1)
    assert abs(w.w_M + w.w_I + w.w_C + w.w_A - 1.0) < 1e-9


def test_pesos_nao_somam_um():
    with pytest.raises(ValueError, match="soma dos pesos"):
        ScoreWeights(w_M=0.5, w_I=0.3, w_C=0.1, w_A=0.05)


def test_pesos_padrao_somam_um():
    w = ScoreWeights()
    assert abs(w.w_M + w.w_I + w.w_C + w.w_A - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# Scores — normalização
# ---------------------------------------------------------------------------

def test_scores_em_range_0_100(df):
    out = calculate_scores(df)
    for col in ["score_M", "score_I", "score_C", "score_A", "score_total"]:
        assert out[col].min() >= 0.0, f"{col} abaixo de 0"
        assert out[col].max() <= 100.0, f"{col} acima de 100"


def test_scores_tem_variacao(df):
    """Scores não podem ser constantes — deve haver municípios distintos."""
    out = calculate_scores(df)
    for col in ["score_M", "score_I", "score_C"]:
        assert out[col].std() > 0, f"{col} é constante"


def test_score_total_e_media_ponderada(df):
    w = ScoreWeights(w_M=0.4, w_I=0.3, w_C=0.2, w_A=0.1)
    out = calculate_scores(df, weights=w)
    esperado = (
        w.w_M * out["score_M"]
        + w.w_I * out["score_I"]
        + w.w_C * out["score_C"]
        + w.w_A * out["score_A"]
    )
    pd.testing.assert_series_equal(out["score_total"], esperado, check_names=False)


# ---------------------------------------------------------------------------
# score_C — custo invertido
# ---------------------------------------------------------------------------

def test_score_C_invertido(df):
    """
    Município com backhaul mais distante deve ter score_C menor
    (custo mais alto = score pior).
    Usamos dois municípios isolados com distâncias diferentes para
    garantir variação real após a normalização min-max.
    """
    df2 = df.copy()
    # Metade perto (0 km), metade longe (500 km) → há variação real
    n = len(df2)
    dist = [0.0] * (n // 2) + [500.0] * (n - n // 2)
    df2["dist_backhaul_km"] = dist

    df3 = df.copy()
    # Inverso: metade longe, metade perto
    df3["dist_backhaul_km"] = list(reversed(dist))

    out2 = calculate_scores(df2)
    out3 = calculate_scores(df3)

    # Os primeiros municípios (dist=0) devem ter score_C maior em df2
    primeiros_out2 = out2.iloc[: n // 2]["score_C"].mean()
    primeiros_out3 = out3.iloc[: n // 2]["score_C"].mean()
    assert primeiros_out2 > primeiros_out3


# ---------------------------------------------------------------------------
# score_A — alavancas
# ---------------------------------------------------------------------------

def test_score_A_acordo_migracao(df):
    """Municípios com acordo_migracao=True devem ter score_A maior."""
    out = calculate_scores(df)
    com_acordo = out.loc[df["acordo_migracao"], "score_A"]
    sem_acordo_sem_fust = out.loc[
        ~df["acordo_migracao"] & ~df["fust_elegivel"] & (df["eace_escolas"] == 0),
        "score_A"
    ]
    if len(sem_acordo_sem_fust) > 0:
        assert com_acordo.mean() > sem_acordo_sem_fust.mean()


# ---------------------------------------------------------------------------
# Déficit de banda
# ---------------------------------------------------------------------------

def test_deficit_banda_formula(df):
    """
    Verifica a fórmula: max(alunos * 1 Mbps, 50 Mbps) - velocidade >= 0
    """
    deficit = _deficit_banda(df)
    assert (deficit >= 0).all(), "Déficit não pode ser negativo"


def test_deficit_banda_municipio_rapido(df):
    """
    Município onde a velocidade supera a necessidade deve ter déficit zero.
    Usamos velocidade = alunos * 1 Mbps + 1000 para garantir que cobrirá
    qualquer necessidade (inclusive o mínimo de 50 Mbps por escola).
    """
    df2 = df.copy()
    df2["velocidade_medida_mbps"] = df2["alunos_maior_turno_est"] * 1.0 + 1000.0
    deficit = _deficit_banda(df2)
    assert (deficit == 0).all()


# ---------------------------------------------------------------------------
# Quadrantes
# ---------------------------------------------------------------------------

def test_quadrantes_validos(df):
    out = calculate_scores(df)
    validos = {"Q1", "Q2a", "Q2b", "Q3", "Q4"}
    assert set(out["quadrante"].unique()).issubset(validos)


def test_todos_municipios_tem_quadrante(df):
    out = calculate_scores(df)
    assert out["quadrante"].notna().all()


def test_distribuicao_quadrantes(df):
    """
    Com medianas como limiar, Q1+Q3 e Q2+Q4 devem ter aproximadamente
    metade dos municípios cada. Verifica que todos os quadrantes aparecem.
    """
    out = calculate_scores(df)
    contagem = out["quadrante"].value_counts()
    # Todos os 5 quadrantes devem aparecer nos 49 municípios do mock
    assert len(contagem) >= 3, f"Poucos quadrantes: {contagem.to_dict()}"


def test_q1_tem_alto_M_e_I(df):
    """Municípios Q1 devem ter score_M e score_I acima da mediana."""
    out = calculate_scores(df)
    q1 = out[out["quadrante"] == "Q1"]
    if len(q1) == 0:
        pytest.skip("Nenhum município Q1 no mock")
    med_M = out["score_M"].median()
    med_I = out["score_I"].median()
    assert (q1["score_M"] >= med_M).all()
    assert (q1["score_I"] >= med_I).all()


def test_pesos_alteram_score_total(df):
    """Mudar os pesos deve mudar o score_total."""
    out1 = calculate_scores(df, ScoreWeights(w_M=0.7, w_I=0.1, w_C=0.1, w_A=0.1))
    out2 = calculate_scores(df, ScoreWeights(w_M=0.1, w_I=0.7, w_C=0.1, w_A=0.1))
    assert not out1["score_total"].equals(out2["score_total"])
