"""Ferramentas de ranking/portfólio/comparação e síntese final pelo modelo."""

from __future__ import annotations

import json

import pytest

from conecta.agent.orchestrator import ChatOrchestrator
from conecta.agent.schemas import ChatContext
from conecta.agent.tools import ToolDispatcher
from conecta.data.loader import load_backhaul, load_municipios
from conecta.geo.distances import add_backhaul_distances
from conecta.scores.calculator import calculate_scores

DATA = __import__("pathlib").Path(__file__).parents[1] / "data"


@pytest.fixture(scope="module")
def mun():
    df = add_backhaul_distances(
        load_municipios(DATA / "mock_municipios.csv"), load_backhaul(DATA / "mock_backhaul.csv")
    )
    df = calculate_scores(df)
    df.attrs["fonte"] = "real"  # exercita a fonte "engine"
    df.attrs["qualidade"] = [{"campo": "hhi", "tipo": "neutro", "cobertura": 0.0}]
    return df


def _run(name, args, mun):
    return ToolDispatcher().dispatch(name, args, mun)


def test_ranking_por_payback_e_uf(mun):
    result, status = _run("ranking_municipios", {"uf": "sp", "criterio": "payback", "top_n": 3}, mun)
    assert status == "success" and result["source"]["id"] == "engine"
    rows = result["data"]["municipios"]
    assert 1 <= len(rows) <= 3 and all(r["uf"] == "SP" for r in rows)
    paybacks = [r["payback_anos"] for r in rows if r["payback_anos"] is not None]
    assert paybacks == sorted(paybacks)


def test_ranking_uf_inexistente_e_criterio_invalido(mun):
    assert _run("ranking_municipios", {"uf": "ZZ"}, mun)[1] == "not_found"
    assert _run("ranking_municipios", {"criterio": "inventado"}, mun)[1] == "failed"


def test_portfolio_respeita_orcamento(mun):
    result, status = _run("otimizar_portfolio", {"orcamento_mi": 50}, mun)
    assert status == "success"
    assert result["data"]["capex_total_mi"] <= 50
    assert len(json.dumps(result)) < 8_000


def test_comparar_informa_ausentes(mun):
    codes = list(mun["id_municipio"].head(2)) + ["9999999"]
    result, status = _run("comparar_municipios", {"codigos_ibge": codes}, mun)
    assert status == "success"
    assert len(result["data"]["municipios"]) == 2 and result["data"]["ausentes"] == ["9999999"]


def test_qualidade_dados(mun):
    data = _run("consultar_qualidade_dados", {}, mun)[0]["data"]
    assert data["campos"][0]["campo"] == "hhi"


class _Fake:
    def __init__(self, replies):
        self.replies, self.calls = list(replies), []

    def chat(self, messages, tools=None):
        self.calls.append((messages, tools))
        return self.replies.pop(0)


def _call(i, name, args):
    return {
        "role": "assistant", "content": None, "finish_reason": "tool_calls",
        "tool_calls": [{"id": i, "type": "function",
                        "function": {"name": name, "arguments": json.dumps(args)}}],
    }


def test_sintese_final_escrita_pelo_modelo_e_contexto_no_prompt(mun):
    same = _call("a", "ranking_municipios", {"criterio": "score_total"})
    fake = _Fake([
        same, {**same, "tool_calls": [{**same["tool_calls"][0], "id": "b"}]},  # repetição → cache
        {"role": "assistant", "content": "Recomendo X.", "finish_reason": "stop"},
    ])
    ctx = ChatContext(pagina="painel", municipio_id="3550308", orcamento_mi=100)
    out = ChatOrchestrator(fake).respond("Onde investir?", [], mun, ctx)

    assert out.response == "Recomendo X."
    assert fake.calls[-1][1] is None  # síntese sem ferramentas
    assert "3550308" in fake.calls[0][0][0]["content"]
    assert "hhi (neutro)" in fake.calls[0][0][0]["content"]
    assert out.data_sources[0].id == "engine" and out.has_demo_data is False
