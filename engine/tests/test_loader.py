"""Testa o carregamento e validação dos CSVs mock."""

from pathlib import Path

import pytest

from conecta.data.loader import load_backhaul, load_municipios

DATA_DIR = Path(__file__).parent.parent / "data"


def test_load_municipios_ok():
    df = load_municipios(DATA_DIR / "mock_municipios.csv")
    assert len(df) == 49
    assert "id_municipio" in df.columns
    assert "score_M" not in df.columns  # loader não calcula scores


def test_load_municipios_id_ibge_sete_digitos():
    df = load_municipios(DATA_DIR / "mock_municipios.csv")
    assert df["id_municipio"].str.len().eq(7).all()


def test_load_municipios_arquivo_inexistente():
    with pytest.raises(FileNotFoundError):
        load_municipios("nao_existe.csv")


def test_load_municipios_schema_invalido(tmp_path):
    csv_ruim = tmp_path / "ruim.csv"
    csv_ruim.write_text(
        "id_municipio,nome,uf\n"
        "99,Nome Curto,XX\n"  # id com 2 dígitos, UF inválida
    )
    with pytest.raises(ValueError, match="inválida"):
        load_municipios(csv_ruim)


def test_load_backhaul_ok():
    df = load_backhaul(DATA_DIR / "mock_backhaul.csv")
    assert {"id_municipio", "lat", "lon"}.issubset(df.columns)
    assert len(df) > 0


def test_load_backhaul_coluna_faltando(tmp_path):
    csv_ruim = tmp_path / "backhaul_ruim.csv"
    csv_ruim.write_text("id_municipio,lat\n3550308,-23.55\n")
    with pytest.raises(ValueError, match="lon"):
        load_backhaul(csv_ruim)
