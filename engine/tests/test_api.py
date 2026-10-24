"""
Testes de integração da API FastAPI.

Usa TestClient do httpx para verificar os endpoints sem subir um servidor real.
O lifespan é executado normalmente, carregando os dados mock.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── GET /municipios ───────────────────────────────────────────────────────────

def test_get_municipios_retorna_lista(client):
    r = client.get("/municipios")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 49


def test_get_municipios_filtro_uf(client):
    r = client.get("/municipios?uf=SP")
    assert r.status_code == 200
    data = r.json()
    assert all(m["uf"] == "SP" for m in data)
    assert len(data) > 0


def test_get_municipios_filtro_quadrante(client):
    r = client.get("/municipios?quadrante=Q1")
    assert r.status_code == 200
    data = r.json()
    assert all(m["quadrante"] == "Q1" for m in data)


def test_get_municipios_tem_scores(client):
    r = client.get("/municipios")
    m = r.json()[0]
    for campo in ["score_M", "score_I", "score_C", "score_A", "score_total", "quadrante"]:
        assert campo in m, f"Campo {campo!r} ausente"


def test_get_municipios_uf_inexistente(client):
    r = client.get("/municipios?uf=ZZ")
    assert r.status_code == 200
    assert r.json() == []


# ── POST /scores ──────────────────────────────────────────────────────────────

def test_post_scores_pesos_customizados(client):
    r = client.post("/scores", json={
        "weights": {"w_M": 0.4, "w_I": 0.3, "w_C": 0.2, "w_A": 0.1}
    })
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 49


def test_post_scores_pesos_invalidos(client):
    r = client.post("/scores", json={
        "weights": {"w_M": 0.5, "w_I": 0.5, "w_C": 0.1, "w_A": 0.1}
    })
    assert r.status_code == 422   # pesos somam 1.2


# ── POST /financial ───────────────────────────────────────────────────────────

def test_post_financial_municipio_existente(client):
    r = client.post("/financial", json={"id_municipio": "3550308"})
    assert r.status_code == 200
    data = r.json()
    assert data["id_municipio"] == "3550308"
    assert data["payback_anos"] > 0
    assert "sensitivity" in data
    assert len(data["sensitivity"]) == 3


def test_post_financial_municipio_inexistente(client):
    r = client.post("/financial", json={"id_municipio": "9999999"})
    assert r.status_code == 404


# ── POST /portfolio ───────────────────────────────────────────────────────────

def test_post_portfolio_basico(client):
    r = client.post("/portfolio", json={"budget": 50.0})
    assert r.status_code == 200
    data = r.json()
    assert "municipios" in data
    assert "capex_total" in data
    assert data["capex_total"] <= 50.0 + 1e-6


def test_post_portfolio_orcamento_zero(client):
    r = client.post("/portfolio", json={"budget": 0.01})
    assert r.status_code in (200, 422)   # 422 se budget <= 0 falhar validação


def test_post_portfolio_filtro_uf(client):
    r = client.post("/portfolio", json={"budget": 100.0, "uf": "SP"})
    assert r.status_code == 200
    data = r.json()
    for m in data["municipios"]:
        assert m["uf"] == "SP"


# ── GET /backtest ─────────────────────────────────────────────────────────────

def test_get_backtest_retorna_estrutura(client):
    r = client.get("/backtest")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert "precision" in data
