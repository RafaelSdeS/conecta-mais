"""Construir × comprar e endpoints de UBS e provedores."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from api.main import app
from conecta.mercado.analise import analisar_mercado


def _p(empresa, porte, acessos, fibra):
    return {"empresa": empresa, "cnpj": "1", "grupo": empresa, "porte": porte, "acessos": acessos, "acessos_fibra": fibra}


def test_mercado_ja_atendido_sugere_parceria():
    r = analisar_mercado([_p("GRANDE", "Grande Porte", 900, 700), _p("PPP", "Pequeno Porte", 200, 100)], 1000)
    assert r["penetracao_fibra_total"] == 0.8 and "parceria" in r["leitura"]


def test_ppps_com_fibra_viram_candidatas():
    r = analisar_mercado([_p("GRANDE", "Grande Porte", 300, 50), _p("PPP A", "Pequeno Porte", 400, 300),
                          _p("PPP B", "Pequeno Porte", 50, 10)], 1000)
    nomes = [c["empresa"] for c in r["candidatas_compra_ou_parceria"]]
    assert nomes == ["PPP A"] and "comprar" in r["leitura"]


def test_pouca_fibra_sugere_construir():
    r = analisar_mercado([_p("PPP", "Pequeno Porte", 100, 20)], 5000)
    assert "construir" in r["leitura"] and r["candidatas_compra_ou_parceria"] == []


@pytest.fixture
def banco(tmp_path, monkeypatch):
    path = tmp_path / "mercado.db"
    with sqlite3.connect(path) as c:
        c.executescript("""
            CREATE TABLE municipios (codigo_ibge TEXT, municipio TEXT, uf TEXT, total_escolas INT,
              escolas_sem_internet INT, escolas_sem_banda_larga INT, escolas_com_medicao INT,
              velocidade_media_escolas_mbps REAL, total_acessos INT, acessos_ftth INT);
            CREATE TABLE ubs (codigo_cnes TEXT, nome TEXT, id_municipio TEXT, lat REAL, lon REAL);
            CREATE TABLE provedores (id_municipio TEXT, empresa TEXT, cnpj TEXT, grupo TEXT, porte TEXT,
              acessos INT, acessos_fibra INT);
            INSERT INTO ubs VALUES ('1','UBS Centro','3550308',-23.5,-46.6),('2','UBS Sul','3550308',-23.6,-46.7);
            INSERT INTO provedores VALUES ('3550308','VIVO','1','TELEFONICA','Grande Porte',900,600),
              ('3550308','PPP X','2','PPP X','Pequeno Porte',300,250);
        """)
    monkeypatch.setenv("CONECTA_SQLITE_PATH", str(path))
    with TestClient(app) as client:
        yield client


def test_endpoint_ubs(banco):
    d = banco.get("/dados/ubs?codigo_municipio=3550308&limite=1").json()
    assert d["total"] == 2 and d["total_retornado"] == 1 and d["ubs"][0]["nome"] == "UBS Centro"


def test_endpoint_provedores_usa_domicilios_do_motor(banco):
    d = banco.get("/dados/provedores/3550308").json()
    assert d["n_provedores"] == 2 and d["provedores"][0]["empresa"] == "VIVO"
    assert banco.get("/dados/provedores/9999999").status_code == 404
