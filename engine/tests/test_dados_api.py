"""Testes das rotas que consultam o SQLite integrado."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from conecta.data.sqlite_repository import (
    SQLiteDataRepository,
    SQLiteDataUnavailable,
)


@pytest.fixture
def sqlite_path(tmp_path: Path) -> Path:
    path = tmp_path / "conecta_test.db"
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE municipios (
                codigo_ibge TEXT PRIMARY KEY,
                municipio TEXT,
                uf TEXT,
                total_escolas INTEGER,
                escolas_sem_internet INTEGER,
                escolas_sem_banda_larga INTEGER,
                escolas_com_medicao INTEGER,
                velocidade_media_escolas_mbps REAL,
                total_acessos INTEGER,
                acessos_ftth INTEGER
            );
            CREATE TABLE escolas (
                CO_ENTIDADE TEXT PRIMARY KEY,
                CO_MUNICIPIO TEXT,
                NO_ENTIDADE TEXT,
                NO_MUNICIPIO TEXT,
                SG_UF TEXT,
                IN_INTERNET INTEGER,
                latitude REAL,
                longitude REAL
            );
            CREATE TABLE validacao_localizacao (
                CO_ENTIDADE TEXT PRIMARY KEY,
                status_localizacao TEXT
            );
            INSERT INTO municipios VALUES
                ('3550308', 'São Paulo', 'SP', 2, 1, 1, 1, 42.5, 100, 75),
                ('3304557', 'Rio de Janeiro', 'RJ', 1, 0, 0, 1, 80.0, 50, 40);
            INSERT INTO escolas VALUES
                ('12345678', '3550308', 'Escola A', 'São Paulo', 'SP', 0, -23.5, -46.6),
                ('23456789', '3550308', 'Escola B', 'São Paulo', 'SP', 1, -23.6, -46.7),
                ('34567890', '3304557', 'Escola C', 'Rio de Janeiro', 'RJ', 0, -22.9, -43.2);
            INSERT INTO validacao_localizacao VALUES
                ('12345678', 'CORRETA'),
                ('23456789', 'DIVERGENTE'),
                ('34567890', 'CORRETA');
            """
        )
    return path


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch, sqlite_path: Path):
    monkeypatch.setenv("CONECTA_SQLITE_PATH", str(sqlite_path))
    with TestClient(app) as test_client:
        yield test_client


def test_busca_municipios_paginada_e_identificada(client: TestClient):
    response = client.get("/dados/municipios?uf=SP&limite=1")

    assert response.status_code == 200
    assert response.headers["X-Conecta-Fonte-Dados"] == "sqlite_integrado"
    assert response.json() == {
        "fonte_dados": "sqlite_integrado",
        "total": 1,
        "total_retornado": 1,
        "limite": 1,
        "offset": 0,
        "municipios": [
            {
                "codigo_ibge": "3550308",
                "municipio": "São Paulo",
                "uf": "SP",
                "total_escolas": 2,
                "escolas_sem_internet": 1,
                "escolas_sem_banda_larga": 1,
                "escolas_com_medicao": 1,
                "velocidade_media_escolas_mbps": 42.5,
                "total_acessos": 100,
                "acessos_ftth": 75,
            }
        ],
    }


def test_consulta_municipio_por_codigo_ibge(client: TestClient):
    response = client.get("/dados/municipios/3550308")

    assert response.status_code == 200
    assert response.headers["X-Conecta-Fonte-Dados"] == "sqlite_integrado"
    assert response.json()["municipio"] == "São Paulo"


def test_listagem_escolas_com_filtro_e_paginacao(client: TestClient):
    response = client.get(
        "/dados/escolas?codigo_municipio=3550308&limite=1&offset=1"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["total_retornado"] == 1
    assert data["offset"] == 1
    assert data["escolas"][0]["CO_ENTIDADE"] == "23456789"
    assert data["escolas"][0]["status_localizacao"] == "DIVERGENTE"


def test_listagem_escolas_sem_internet_paginada(client: TestClient):
    response = client.get(
        "/dados/escolas/sem-internet?codigo_municipio=3550308&limite=1"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["criterio"] == "INEP: IN_INTERNET = 0"
    assert data["total_sem_internet"] == 1
    assert data["escolas"][0]["codigo_inep"] == "12345678"


def test_indicadores_incluem_validacao_geografica(client: TestClient):
    response = client.get("/dados/indicadores/3550308")

    assert response.status_code == 200
    data = response.json()
    assert data["fonte_dados"] == "sqlite_integrado"
    assert data["municipio"]["acessos_ftth"] == 75
    assert data["validacao_geografica"] == {"CORRETA": 1, "DIVERGENTE": 1}


def test_codigo_ibge_inexistente_retorna_404(client: TestClient):
    assert client.get("/dados/municipios/9999999").status_code == 404
    assert client.get("/dados/indicadores/9999999").status_code == 404
    assert (
        client.get(
            "/dados/escolas/sem-internet?codigo_municipio=9999999"
        ).status_code
        == 404
    )


def test_codigos_ibge_e_inep_sao_validados(client: TestClient):
    assert client.get("/dados/municipios/123").status_code == 422
    assert (
        client.get("/dados/escolas?codigo_municipio=123").status_code == 422
    )
    assert (
        client.get("/dados/escolas?codigo_escola=123").status_code == 422
    )


def test_banco_ausente_nao_afeta_rotas_do_engine(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
):
    monkeypatch.setenv(
        "CONECTA_SQLITE_PATH", str(tmp_path / "inexistente.db")
    )
    with TestClient(app) as test_client:
        response = test_client.get("/dados/municipios")
        assert response.status_code == 503
        assert "não encontrado" in response.json()["detail"]
        assert test_client.get("/municipios").status_code == 200


def test_banco_nao_configurado_retorna_503_sem_afetar_engine(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.delenv("CONECTA_SQLITE_PATH", raising=False)
    with TestClient(app) as test_client:
        response = test_client.get("/dados/municipios")
        assert response.status_code == 503
        assert "CONECTA_SQLITE_PATH" in response.json()["detail"]
        assert test_client.get("/municipios").status_code == 200


def test_acesso_sqlite_nao_permite_escrita(
    client: TestClient,
    sqlite_path: Path,
):
    before = sqlite_path.read_bytes()
    assert client.get("/dados/municipios").status_code == 200

    with pytest.raises(SQLiteDataUnavailable):
        with SQLiteDataRepository(sqlite_path)._connection() as connection:
            connection.execute(
                "UPDATE municipios SET municipio = 'alterado' "
                "WHERE codigo_ibge = '3550308'"
            )

    assert sqlite_path.read_bytes() == before


def test_rotas_existentes_do_engine_continuam_disponiveis(client: TestClient):
    assert client.get("/municipios").status_code == 200
    assert client.post(
        "/scores",
        json={"weights": {"w_M": 0.25, "w_I": 0.25, "w_C": 0.25, "w_A": 0.25}},
    ).status_code == 200
    assert client.post(
        "/financial", json={"id_municipio": "3550308"}
    ).status_code == 200
    assert client.post("/portfolio", json={"budget": 50.0}).status_code == 200
    assert client.get("/backtest").status_code == 200
