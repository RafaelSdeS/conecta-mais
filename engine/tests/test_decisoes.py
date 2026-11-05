"""Registro de decisões: só inclusão, números recalculados no servidor, validação na entrada."""

import pytest
from fastapi.testclient import TestClient

from api.main import app

CENARIO = {"orcamento_mi": 50, "objetivo": "equilibrado", "escopo": {"uf": "SP"}}


def _decisao(**extra):
    return {
        "id_municipio": "3550308", "decisao": "aprovar",
        "motivo": "Prefeitura cede postes e terreno.",
        "responsavel": "Gestora Sudeste", "cenario": CENARIO, **extra,
    }


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setenv("CONECTA_DECISOES_PATH", str(tmp_path / "decisoes.db"))
    with TestClient(app) as c:
        yield c


def test_registra_com_numeros_do_servidor(api):
    # números enviados pelo cliente são ignorados
    r = api.post("/decisoes", json=_decisao(numeros={"capex_mi": 0}))
    assert r.status_code == 201
    d = r.json()
    assert d["numeros"]["capex_mi"] > 0 and d["numeros"]["quadrante"]
    assert d["fonte_dados"] == "mock" and d["cenario"]["escopo"]["uf"] == "SP"
    assert api.get("/decisoes").json()[0]["id"] == d["id"]


def test_historico_preservado_e_vigente_e_a_mais_recente(api):
    api.post("/decisoes", json=_decisao())
    api.post("/decisoes", json=_decisao(decisao="adiar", motivo="Aguardar edital do FUST 2027."))
    api.post("/decisoes", json=_decisao(id_municipio="3304557", decisao="descartar"))
    hist = api.get("/decisoes", params={"id_municipio": "3550308"}).json()
    assert [h["decisao"] for h in hist] == ["adiar", "aprovar"]
    vigentes = {v["id_municipio"]: v["decisao"] for v in api.get("/decisoes").json()}
    assert vigentes == {"3550308": "adiar", "3304557": "descartar"}


def test_validacao_na_entrada(api):
    assert api.post("/decisoes", json=_decisao(motivo="curto")).status_code == 422
    assert api.post("/decisoes", json=_decisao(motivo=" " * 20)).status_code == 422
    assert api.post("/decisoes", json=_decisao(decisao="talvez")).status_code == 422
    assert api.post("/decisoes", json=_decisao(id_municipio="9999999")).status_code == 404
    assert api.get("/decisoes", params={"id_municipio": "x"}).status_code == 422
