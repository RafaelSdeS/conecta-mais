"""Endpoints /ia/*: justificativa, narrativa de portfólio e filtros em linguagem natural."""

from __future__ import annotations

import json
import os

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routers.chat import get_watsonx_client
from conecta.agent.watsonx import WatsonxUnavailableError


class _Fake:
    def __init__(self, content="Texto gerado.", error=None):
        self.content, self.error, self.calls = content, error, []

    def chat(self, messages, tools=None):
        self.calls.append((messages, tools))
        if self.error:
            raise self.error
        return {"role": "assistant", "content": self.content, "finish_reason": "stop"}


@pytest.fixture
def api():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_watsonx_client, None)


def _use(fake):
    app.dependency_overrides[get_watsonx_client] = lambda: fake
    return fake


def test_justificativa_usa_dados_do_motor_e_cacheia(api):
    fake = _use(_Fake("Justificativa."))
    r = api.post("/ia/justificativa", json={"id_municipio": "3550308"})
    assert r.status_code == 200 and r.json()["texto"] == "Justificativa."
    enviado = json.loads(fake.calls[0][0][1]["content"])
    assert enviado["nome"] == "São Paulo" and "payback_anos" in enviado
    # Custa mais que o orçamento padrão de R$ 30 mi: o servidor calcula a situação, não o front.
    assert enviado["situacao_no_plano"]["status"] == "nao_cabe"
    assert fake.calls[0][1] is None
    api.post("/ia/justificativa", json={"id_municipio": "3550308"})
    assert len(fake.calls) == 1  # segunda chamada vem do cache


def test_justificativa_municipio_inexistente_e_erro_do_watsonx(api):
    _use(_Fake())
    assert api.post("/ia/justificativa", json={"id_municipio": "9999999"}).status_code == 404
    assert api.post("/ia/justificativa", json={"id_municipio": "123"}).status_code == 422
    _use(_Fake(error=WatsonxUnavailableError()))
    r = api.post("/ia/justificativa", json={"id_municipio": "3304557"})
    assert r.status_code == 503 and "watsonx" in r.json()["detail"].lower()


def test_justificativa_usa_o_cenario_da_tela(api):
    fake = _use(_Fake("J."))
    api.post("/ia/justificativa", json={"id_municipio": "4106902"})
    api.post("/ia/justificativa", json={
        "id_municipio": "4106902",
        "cenario": {
            "orcamento_mi": 5000, "objetivo": "alunos", "escopo": {"uf": "PR"},
            "params": {"arpu_mensal": 150},
        },
    })
    assert len(fake.calls) == 2  # cenário diferente não reaproveita o cache
    padrao, outro = (json.loads(c[0][1]["content"]) for c in fake.calls)
    assert outro["payback_anos"] < padrao["payback_anos"]
    assert outro["situacao_no_plano"]["status"] == "selecionado"
    assert outro["cenario"]["recorte"]["uf"] == "PR" and outro["cenario"]["objetivo"] == "alunos"


def test_achados_ligam_cada_cartao_a_uma_acao_do_motor(api):
    fake = _use(_Fake(json.dumps({"cartoes": [
        {"id": "mais_orcamento", "titulo": "Mais orçamento", "texto": "Com R$ 360 mi entram mais."},
        {"id": "inventado", "titulo": "X", "texto": "Y"},
    ]})))
    r = api.post("/ia/achados", json={"orcamento_mi": 300, "objetivo": "equilibrado"})
    assert r.status_code == 200
    cartoes = r.json()["cartoes"]
    assert [c["id"] for c in cartoes] == ["mais_orcamento"]  # id desconhecido é descartado
    acao = cartoes[0]["acao"]
    assert acao["tipo"] == "aplicar_cenario" and acao["orcamento_mi"] == 360
    enviados = json.loads(fake.calls[0][0][1]["content"])["achados"]
    assert any(a["id"] == "mais_orcamento" for a in enviados)
    assert all("acao" not in a for a in enviados)  # a ação fica no servidor, fora do prompt


def test_achados_com_json_quebrado(api):
    _use(_Fake("Não é JSON."))
    r = api.post("/ia/achados", json={"orcamento_mi": 300, "objetivo": "equilibrado"})
    assert r.status_code == 422


def test_narrativa_do_portfolio(api):
    fake = _use(_Fake("Narrativa."))
    r = api.post("/ia/portfolio-narrativa", json={"ids": ["3550308", "3304557"], "orcamento_mi": 50})
    assert r.status_code == 200 and r.json()["texto"] == "Narrativa."
    enviado = json.loads(fake.calls[0][0][1]["content"])
    assert enviado["n_municipios"] == 2 and enviado["capex_total_mi"] > 0
    assert api.post("/ia/portfolio-narrativa", json={"ids": ["x"], "orcamento_mi": 5}).status_code == 422


def test_filtros_validos_e_invalidos(api):
    _use(_Fake('Claro: {"uf": "ba", "quadrante": "Q1", "busca": null, "apenas_portfolio": true}'))
    r = api.post("/ia/filtros", json={"texto": "q1 da bahia no portfólio"})
    assert r.json() == {"uf": "BA", "quadrante": "Q1", "busca": None, "apenas_portfolio": True}

    _use(_Fake('{"quadrante": "Q9"}'))
    assert api.post("/ia/filtros", json={"texto": "qualquer coisa"}).status_code == 422
    _use(_Fake("não sei"))
    assert api.post("/ia/filtros", json={"texto": "qualquer coisa"}).status_code == 422


def test_auditoria_registra_sem_texto_do_usuario(api):
    log = os.environ["CONECTA_AUDIT_LOG"]
    if os.path.exists(log):
        os.remove(log)
    _use(_Fake('{"uf": null}'))
    api.post("/ia/filtros", json={"texto": "segredo-do-usuario"})
    linhas = open(log, encoding="utf-8").read()
    assert '"/ia/filtros"' in linhas and "segredo-do-usuario" not in linhas


def test_painel_de_auditoria_resume_o_log(api):
    log = os.environ["CONECTA_AUDIT_LOG"]
    if os.path.exists(log):
        os.remove(log)
    assert api.get("/ia/auditoria").json()["total"] == 0
    _use(_Fake('{"uf": null}'))
    api.post("/ia/filtros", json={"texto": "qualquer coisa"})
    _use(_Fake(error=WatsonxUnavailableError()))
    api.post("/ia/filtros", json={"texto": "outra coisa"})
    d = api.get("/ia/auditoria").json()
    assert d["total"] == 2 and d["ok"] == 1 and d["taxa_ok"] == 0.5
    assert d["por_endpoint"] == {"/ia/filtros": 2} and len(d["ultimas"]) == 2
    assert "texto" not in json.dumps(d)  # nada do que o usuário digitou
