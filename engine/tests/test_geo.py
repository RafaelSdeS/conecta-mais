"""
Testes do módulo de distâncias ao backhaul.

Cobre:
- Município que já está na lista de backhaul → dist = 0
- Distância entre dois pontos conhecidos (São Paulo → Rio de Janeiro ≈ 357 km)
- DataFrame de backhaul vazio → dist = NaN
- Resultado não tem valores negativos
- A coluna dist_backhaul_km é adicionada ao DataFrame original intacto
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from conecta.data.loader import load_backhaul, load_municipios
from conecta.geo.distances import _haversine_km, add_backhaul_distances

DATA_DIR = Path(__file__).parent.parent / "data"


@pytest.fixture()
def municipios():
    return load_municipios(DATA_DIR / "mock_municipios.csv")


@pytest.fixture()
def backhaul():
    return load_backhaul(DATA_DIR / "mock_backhaul.csv")


# ---------------------------------------------------------------------------
# Função auxiliar haversine
# ---------------------------------------------------------------------------

def test_haversine_sp_rj():
    """
    Distância São Paulo → Rio de Janeiro.
    Valor de referência: ~357 km (centróides das cidades).
    Tolerância: ±10 km (centróides aproximados).
    """
    # SP: -23.5505, -46.6333  |  RJ: -22.9068, -43.1729
    dist = _haversine_km(-23.5505, -46.6333, -22.9068, -43.1729)
    assert 347 < dist < 367, f"Distância SP→RJ fora do esperado: {dist:.1f} km"


def test_haversine_mesmo_ponto():
    dist = _haversine_km(-23.5505, -46.6333, -23.5505, -46.6333)
    assert dist == pytest.approx(0.0, abs=1e-6)


def test_haversine_simetrica():
    d1 = _haversine_km(-23.5505, -46.6333, -22.9068, -43.1729)
    d2 = _haversine_km(-22.9068, -43.1729, -23.5505, -46.6333)
    assert d1 == pytest.approx(d2, rel=1e-9)


# ---------------------------------------------------------------------------
# add_backhaul_distances
# ---------------------------------------------------------------------------

def test_municipio_com_backhaul_recebe_zero(municipios, backhaul):
    """IDs presentes no backhaul CSV devem ter dist_backhaul_km == 0."""
    out = add_backhaul_distances(municipios, backhaul)
    ids_bh = set(backhaul["id_municipio"].astype(str))
    zeros = out.loc[out["id_municipio"].isin(ids_bh), "dist_backhaul_km"]
    assert (zeros == 0.0).all(), f"Esperado 0 km para municípios com backhaul: {zeros[zeros != 0]}"


def test_municipio_sem_backhaul_tem_distancia_positiva(municipios, backhaul):
    """Municípios fora da lista de backhaul devem ter distância > 0."""
    out = add_backhaul_distances(municipios, backhaul)
    ids_bh = set(backhaul["id_municipio"].astype(str))
    sem_bh = out.loc[~out["id_municipio"].isin(ids_bh), "dist_backhaul_km"]
    assert (sem_bh > 0).all()


def test_distancias_nao_negativas(municipios, backhaul):
    out = add_backhaul_distances(municipios, backhaul)
    assert (out["dist_backhaul_km"] >= 0).all()


def test_coluna_preenchida_apos_calculo(municipios, backhaul):
    """A coluna dist_backhaul_km existe no schema mas chega nula; deve ser preenchida."""
    assert municipios["dist_backhaul_km"].isna().all(), "Mock deveria chegar com dist nula"
    out = add_backhaul_distances(municipios, backhaul)
    assert out["dist_backhaul_km"].notna().all()


def test_dataframe_original_nao_mutado(municipios, backhaul):
    """A função deve retornar uma cópia — o DataFrame original não é alterado."""
    dist_antes = municipios["dist_backhaul_km"].copy()
    _ = add_backhaul_distances(municipios, backhaul)
    pd.testing.assert_series_equal(municipios["dist_backhaul_km"], dist_antes)


def test_backhaul_vazio_retorna_nan(municipios):
    bh_vazio = pd.DataFrame(columns=["id_municipio", "lat", "lon"])
    out = add_backhaul_distances(municipios, bh_vazio)
    assert out["dist_backhaul_km"].isna().all()


def test_distancia_maxima_brasil_plausivel(municipios, backhaul):
    """
    Nenhum município do Brasil pode estar a mais de ~4.400 km de outro
    (distância máxima ponta a ponta do território).
    """
    out = add_backhaul_distances(municipios, backhaul)
    assert out["dist_backhaul_km"].max() < 4400
