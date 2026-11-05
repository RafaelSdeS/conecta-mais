"""Testa o carregamento e validação dos CSVs mock."""

from pathlib import Path

import pandas as pd
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


def test_total_escolas_e_opcional_no_schema():
    from conecta.data.schema import Municipio

    campos = Municipio.model_fields
    assert campos["total_escolas"].default == 0 and campos["semiarido"].default is False


def test_area_cobre_municipios_criados_depois_de_2010():
    """Sem área, o município é descartado na validação do ETL."""
    area = pd.read_parquet(Path(__file__).parent.parent / "data" / "raw" / "ibge_area_km2.parquet")
    assert len(area) == 5570
    criados = {"1504752", "4212650", "4220000", "4314548", "5006275"}
    assert criados <= set(area["id_municipio"])
    assert (area["area_km2"] > 0).all()


def test_domicilios_vem_da_tabela_de_domicilios_e_nao_da_populacao():
    dom = pd.read_parquet(Path(__file__).parent.parent / "data" / "raw" / "ibge_domicilios.parquet")
    assert dom["domicilios_total"].sum() == 72_456_368  # total de domicílios ocupados no Censo 2022
    assert dom.set_index("id_municipio").loc["2927408", "domicilios_total"] == 958_575  # Salvador


def test_kit_de_visita_usa_o_mesmo_criterio_do_veredito():
    raw = Path(__file__).parent.parent / "data" / "raw"
    visita = pd.read_parquet(raw / "inep_escolas_visita.parquet")
    agregado = pd.read_parquet(raw / "inep_municipios_agg.parquet")
    assert len(visita) == agregado["escolas_sem_internet_aprendizagem"].sum()
    assert visita["alunos"].sum() == agregado["alunos_sem_internet"].sum()

