"""Testes de contrato e orquestração do chat sem chamadas ao watsonx.ai."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routers.chat import get_watsonx_client
from conecta.agent.orchestrator import MAX_TOOL_CALLS, MAX_TOOL_ROUNDS
from conecta.agent.watsonx import (
    WatsonxAuthenticationError,
    WatsonxTimeoutError,
)
from conecta.rag.catalog import REPOSITORY_ROOT
from conecta.rag.indexer import build_index


def _assistant(content: str):
    return {
        "role": "assistant",
        "content": content,
        "finish_reason": "stop",
    }


def _tool(name: str, arguments: dict, call_id: str = "call-1"):
    return {
        "role": "assistant",
        "content": None,
        "finish_reason": "tool_calls",
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": json.dumps(arguments, ensure_ascii=False),
                },
            }
        ],
    }


class FakeWatsonxClient:
    def __init__(self, replies: list[dict] | None = None, error: Exception | None = None):
        self.replies = list(replies or [])
        self.error = error
        self.calls: list[tuple[list[dict], list[dict]]] = []

    def chat(self, messages: list[dict], tools: list[dict]) -> dict:
        self.calls.append((messages, tools))
        if self.error is not None:
            raise self.error
        if not self.replies:
            raise AssertionError("Unexpected watsonx.ai call")
        return self.replies.pop(0)


@pytest.fixture
def sqlite_path(tmp_path: Path) -> Path:
    path = tmp_path / "chat_test.db"
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
                ('4314902', 'Porto Alegre', 'RS', 2, 1, 1, 1, 40.0, 100, 80),
                ('3550308', 'São Paulo', 'SP', 1, 0, 0, 1, 75.0, 200, 150),
                ('5200055', 'Abadia de Goiás', 'GO', 0, 0, 0, 0, NULL, 0, 0);
            INSERT INTO escolas VALUES
                ('12345678', '4314902', 'Escola Porto', 'Porto Alegre', 'RS', 0, -30.0, -51.2),
                ('23456789', '4314902', 'Escola Sul', 'Porto Alegre', 'RS', 1, -30.1, -51.3),
                ('34567890', '3550308', 'Escola SP', 'São Paulo', 'SP', 1, -23.5, -46.6);
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
    app.dependency_overrides.pop(get_watsonx_client, None)


def _install_fake(fake: FakeWatsonxClient) -> None:
    app.dependency_overrides[get_watsonx_client] = lambda: fake


def test_chat_sem_ferramentas(client: TestClient):
    fake = FakeWatsonxClient([_assistant("Olá! Sou o assistente Conecta+.")])
    _install_fake(fake)

    response = client.post("/chat", json={"message": "Quem é você?"})

    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "Olá! Sou o assistente Conecta+."
    assert data["tools_executed"] == []
    assert data["data_sources"] == []
    assert data["has_demo_data"] is False
    assert data["references"] == []
    system_prompt = fake.calls[0][0][0]["content"]
    assert "sem chamar ferramentas" in system_prompt
    assert data["history"][-1] == {
        "role": "assistant",
        "content": "Olá! Sou o assistente Conecta+.",
    }


def test_chat_preserva_referencias_rag_estruturadas_no_contrato_http(
    client: TestClient,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    index_path = tmp_path / "chat-rag.sqlite"
    build_index(index_path, repository_root=REPOSITORY_ROOT)
    monkeypatch.setenv("CONECTA_RAG_INDEX_PATH", str(index_path))
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_documentacao_conecta",
                {"pergunta": "fórmula score_A acordo_migracao fust_elegivel"},
            ),
            _assistant(
                "A seria score_A = minmax(acordo_migracao + fust_elegivel)."
            ),
        ]
    )
    _install_fake(fake)

    response = client.post(
        "/chat",
        json={
            "message": (
                "Qual é a fórmula do score_A e o que significam M, I, C e A?"
            )
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "score_A = minmax(" not in data["response"]
    assert 'df["acordo_migracao"].astype(float) * 50.0' in data["response"]
    assert data["data_sources"][0]["id"] == "rag_tecnico"
    assert data["tools_executed"] == [
        {"name": "consultar_documentacao_conecta", "status": "success"}
    ]
    assert any(
        reference["source_path"] == "engine/conecta/scores/calculator.py"
        and reference["section"] == "_score_A"
        and reference["line_start"] <= reference["line_end"]
        and reference["is_official"] is False
        for reference in data["references"]
    )


def test_limites_de_ferramentas_permanecem_restritos():
    assert MAX_TOOL_ROUNDS == 5
    assert MAX_TOOL_CALLS == 10


def test_resposta_parcial_do_modelo_e_identificada_como_incompleta(
    client: TestClient,
):
    fake = FakeWatsonxClient(
        [
            {
                "role": "assistant",
                "content": "Sou o assistente Conecta+ e posso ajudar com",
                "finish_reason": "length",
            }
        ]
    )
    _install_fake(fake)

    response = client.post(
        "/chat",
        json={"message": "Quem é você e o que consegue fazer no Conecta+?"},
    )

    assert response.status_code == 502
    data = response.json()
    assert data["response"] == "Sou o assistente Conecta+ e posso ajudar com"
    assert data["error"]["code"] == "watsonx_incomplete_response"
    assert data["history"] == []
    assert data["tools_executed"] == []


def test_chat_consulta_indicadores_escolares_reais(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_indicadores_escolares",
                {"codigo_ibge": "4314902"},
            ),
            _assistant("Porto Alegre tem 2 escolas, sendo 1 sem internet."),
        ]
    )
    _install_fake(fake)

    response = client.post(
        "/chat", json={"message": "Quantas escolas de Porto Alegre estão sem internet?"}
    )

    data = response.json()
    assert response.status_code == 200
    assert data["tools_executed"] == [
        {"name": "consultar_indicadores_escolares", "status": "success"}
    ]
    assert data["data_sources"][0]["id"] == "sqlite_integrado"
    assert data["has_demo_data"] is False
    tool_message = fake.calls[1][0][-1]
    assert json.loads(tool_message["content"])["data"]["municipio"]["escolas_sem_internet"] == 1


def test_chat_lista_escolas_sem_internet_por_codigo_ibge(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "listar_escolas_sem_internet",
                {"codigo_ibge": "4314902", "limite": 20},
                "schools",
            ),
            _assistant("O SQLite integrado registra uma escola sem internet."),
        ]
    )
    _install_fake(fake)

    response = client.post(
        "/chat",
        json={"message": "Quantas escolas estão sem internet em Porto Alegre, RS?"},
    )

    data = response.json()
    assert response.status_code == 200
    assert data["response"] == "O SQLite integrado registra uma escola sem internet."
    assert data["data_sources"][0]["id"] == "sqlite_integrado"
    assert data["has_demo_data"] is False
    tool_message = fake.calls[1][0][-1]
    assert tool_message["tool_call_id"] == "schools"
    result = json.loads(tool_message["content"])
    assert result["data"]["total_sem_internet"] == 1
    assert result["data"]["municipio"] == "Porto Alegre"


def test_resolucao_ibge_reutilizada_na_consulta_escolar_e_finalizada(
    client: TestClient,
):
    fake = FakeWatsonxClient(
        [
            _tool(
                "buscar_municipio_real",
                {"municipio": "Porto Alegre, RS", "uf": "rs"},
                "lookup",
            ),
            _tool(
                "listar_escolas_sem_internet",
                {
                    "municipio": "Porto Alegre, RS",
                    "uf": "rs",
                    "limite": 20,
                },
                "schools",
            ),
            _tool(
                "listar_escolas_sem_internet",
                {
                    "municipio": "porto alegre",
                    "uf": "RS",
                    "limite": 20,
                },
                "schools-repeat",
            ),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat",
        json={"message": "Quantas escolas estão sem internet em Porto Alegre, RS?"},
    ).json()

    assert len(fake.calls) == 3
    assert data["response"] == (
        "O SQLite integrado registra 1 escola sem internet em Porto Alegre (RS), "
        "segundo o critério INEP indicado."
    )
    assert data["error"] is None
    assert data["data_sources"][0]["id"] == "sqlite_integrado"
    assert data["has_demo_data"] is False
    assert [item["status"] for item in data["tools_executed"]] == [
        "success",
        "success",
        "cached",
    ]

    follow_up_messages = fake.calls[2][0]
    lookup_reply = next(
        message
        for message in follow_up_messages
        if message.get("role") == "tool"
        and message.get("tool_call_id") == "lookup"
    )
    assert json.loads(lookup_reply["content"])["data"]["codigo_ibge"] == "4314902"
    assistant_call = next(
        message
        for message in follow_up_messages
        if message.get("role") == "assistant"
        and message.get("tool_calls", [{}])[0].get("id") == "schools"
    )
    assert assistant_call["tool_calls"][0]["function"]["name"] == (
        "listar_escolas_sem_internet"
    )
    school_reply = next(
        message
        for message in follow_up_messages
        if message.get("role") == "tool"
        and message.get("tool_call_id") == "schools"
    )
    assert school_reply["tool_call_id"] == "schools"
    assert json.loads(school_reply["content"])["data"]["total_sem_internet"] == 1


@pytest.mark.parametrize(
    ("name", "arguments"),
    [
        (
            "listar_escolas_municipio",
            {"municipio": "Porto Alegre", "uf": "RS", "limite": 2},
        ),
        (
            "listar_escolas_sem_internet",
            {"municipio": "Porto Alegre", "uf": "RS", "limite": 2},
        ),
    ],
)
def test_chat_lista_escolas_reais(
    client: TestClient,
    name: str,
    arguments: dict,
):
    fake = FakeWatsonxClient(
        [
            _tool(name, arguments),
            _assistant("A escola foi localizada na base integrada."),
        ]
    )
    _install_fake(fake)

    response = client.post(
        "/chat", json={"message": "Liste escolas em Porto Alegre"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["data_sources"][0]["id"] == "sqlite_integrado"
    tool_result = json.loads(fake.calls[1][0][-1]["content"])
    assert tool_result["data"]["escolas"][0]["escola"] == "Escola Porto"


def test_chat_consulta_scores_demonstrativos_do_motor(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_scores_municipio",
                {"municipio": "Porto Alegre", "uf": "RS"},
            ),
            _assistant("O score de Porto Alegre é demonstrativo."),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat", json={"message": "Qual o score de Porto Alegre no motor?"}
    ).json()

    assert data["tools_executed"][0]["status"] == "success"
    assert data["data_sources"][0]["id"] == "engine_mock"
    assert data["has_demo_data"] is True
    tool_result = json.loads(fake.calls[1][0][-1]["content"])
    assert tool_result["data"]["nome"] == "Porto Alegre"
    assert "score_total" in tool_result["data"]


def test_score_porto_alegre_por_codigo_ibge_finaliza_com_valor_demonstrativo(
    client: TestClient,
):
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_scores_municipio",
                {"codigo_ibge": "4314902"},
                "score-1",
            ),
            _tool(
                "consultar_scores_municipio",
                {"codigo_ibge": "4314902"},
                "score-2",
            ),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat",
        json={"message": "Qual é o score de Porto Alegre, RS, no motor de cálculo?"},
    ).json()

    assert data["response"] == (
        "No motor demonstrativo (engine_mock), o score total de Porto Alegre (RS) "
        "é 41,33. O resultado usa dados demonstrativos."
    )
    assert data["error"] is None
    assert data["data_sources"][0]["id"] == "engine_mock"
    assert data["has_demo_data"] is True
    assert [item["status"] for item in data["tools_executed"]] == [
        "success",
        "cached",
    ]


def test_score_por_nome_com_uf_no_texto_encontra_csv_e_acento_normalizado(
    client: TestClient,
):
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_scores_municipio",
                {"municipio": "  Porto   Alegre, RS ", "uf": "rs"},
            ),
            _assistant("O score de Porto Alegre foi consultado no motor demonstrativo."),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat",
        json={"message": "Qual é o score de Porto Alegre, RS?"},
    ).json()

    result = json.loads(fake.calls[1][0][-1]["content"])
    assert data["response"] == (
        "O score de Porto Alegre foi consultado no motor demonstrativo."
    )
    assert result["ok"] is True
    assert result["data"]["id_municipio"] == "4314902"
    assert result["data"]["score_total"] == pytest.approx(41.3275569600206)
    assert data["data_sources"][0]["id"] == "engine_mock"
    assert data["has_demo_data"] is True


def test_chat_combina_consulta_real_e_motor_demo(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_indicadores_escolares",
                {"codigo_ibge": "4314902"},
                "call-indicadores",
            ),
            _tool(
                "consultar_scores_municipio",
                {"municipio": "Porto Alegre", "uf": "RS"},
                "call-scores",
            ),
            _assistant(
                "As escolas vêm do SQLite real; o score é do motor demonstrativo."
            ),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat",
        json={"message": "Compare os indicadores escolares e o score de Porto Alegre"},
    ).json()

    assert {source["id"] for source in data["data_sources"]} == {
        "sqlite_integrado",
        "engine_mock",
    }
    assert data["has_demo_data"] is True
    assert len(data["tools_executed"]) == 2
    tool_results = [json.loads(call[0][-1]["content"]) for call in fake.calls[1:]]
    assert all(result["ok"] for result in tool_results)


def test_municipio_inexistente_na_base_real(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "buscar_municipio_real",
                {"municipio": "Município Inventado", "uf": "RS"},
            ),
            _assistant("O município não foi encontrado na base real."),
        ]
    )
    _install_fake(fake)

    response = client.post(
        "/chat", json={"message": "Consulte Município Inventado no RS"}
    )

    assert response.status_code == 200
    tool_result = json.loads(fake.calls[1][0][-1]["content"])
    assert tool_result["ok"] is False
    assert tool_result["error"]["code"] == "not_found"
    assert response.json()["tools_executed"][0]["status"] == "not_found"


def test_municipio_real_ausente_no_motor_nao_gera_score(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "buscar_municipio_real",
                {"municipio": "Abadia de Goiás", "uf": "GO"},
                "lookup",
            ),
            _tool(
                "consultar_scores_municipio",
                {"municipio": "Abadia de Goiás", "uf": "GO"},
                "score",
            ),
            _assistant("O município existe na base real, mas não no motor demonstrativo."),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat", json={"message": "Qual o score de Abadia de Goiás?"}
    ).json()
    tool_outputs = [
        json.loads(message["content"])
        for message in fake.calls[2][0]
        if message["role"] == "tool"
    ]
    real_lookup, tool_result = tool_outputs

    assert real_lookup["ok"] is True
    assert real_lookup["data"]["municipio"] == "Abadia de Goiás"
    assert tool_result["ok"] is False
    assert tool_result["source"]["id"] == "engine_mock"
    assert tool_result["error"]["code"] == "not_found"
    assert data["has_demo_data"] is False
    assert "não no motor demonstrativo" in data["response"]
    assert {item["id"] for item in data["data_sources"]} == {
        "sqlite_integrado",
        "engine_mock",
    }


def test_erro_de_autenticacao_ibm_retorna_erro_estruturado(client: TestClient):
    _install_fake(FakeWatsonxClient(error=WatsonxAuthenticationError()))

    response = client.post("/chat", json={"message": "Olá"})

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "watsonx_authentication_failed"
    assert response.json()["response"] is None


def test_timeout_ibm_retorna_erro_estruturado(client: TestClient):
    _install_fake(FakeWatsonxClient(error=WatsonxTimeoutError()))

    response = client.post("/chat", json={"message": "Olá"})

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "watsonx_timeout"


def test_watsonx_sem_configuracao_retorna_503(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    app.dependency_overrides.pop(get_watsonx_client, None)
    for key in (
        "WATSONX_APIKEY",
        "WATSONX_PROJECT_ID",
        "WATSONX_URL",
        "WATSONX_MODEL_ID",
    ):
        monkeypatch.delenv(key, raising=False)

    response = client.post("/chat", json={"message": "Olá"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "watsonx_not_configured"


def test_ferramenta_invalida_nao_executa_codigo_arbitrario(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool("executar_sql", {"sql": "DROP TABLE municipios"}),
            _assistant("A ferramenta solicitada não está disponível."),
        ]
    )
    _install_fake(fake)

    response = client.post("/chat", json={"message": "Execute a ferramenta"})

    assert response.status_code == 200
    assert response.json()["tools_executed"][0]["status"] == "failed"
    result = json.loads(fake.calls[1][0][-1]["content"])
    assert result["error"]["code"] == "unknown_tool"
    assert client.get("/dados/municipios?limite=1").status_code == 200


def test_argumentos_invalidos_nao_chegam_ao_dispatcher(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_indicadores_escolares",
                {"codigo_ibge": "3550308; DROP TABLE escolas"},
            ),
            _assistant("O código fornecido é inválido."),
        ]
    )
    _install_fake(fake)

    response = client.post("/chat", json={"message": "Consulte o indicador"})

    assert response.status_code == 200
    assert response.json()["tools_executed"][0]["status"] == "failed"
    result = json.loads(fake.calls[1][0][-1]["content"])
    assert result["error"]["code"] == "invalid_arguments"
    assert client.get("/dados/escolas?limite=1").status_code == 200


def test_chamadas_repetidas_reutilizam_resultado(client: TestClient):
    fake = FakeWatsonxClient(
        [
            {
                "role": "assistant",
                "content": None,
                "finish_reason": "tool_calls",
                "tool_calls": [
                    _tool(
                        "consultar_indicadores_escolares",
                        {"codigo_ibge": "4314902"},
                        "call-1",
                    )["tool_calls"][0],
                    _tool(
                        "consultar_indicadores_escolares",
                        {"codigo_ibge": "4314902"},
                        "call-2",
                    )["tool_calls"][0],
                ],
            },
            _assistant("Consulta concluída uma única vez."),
        ]
    )
    _install_fake(fake)

    data = client.post("/chat", json={"message": "Consulte os indicadores"}).json()

    assert [item["status"] for item in data["tools_executed"]] == [
        "success",
        "cached",
    ]
    assert fake.calls[1][0][-2]["role"] == "tool"
    assert fake.calls[1][0][-1]["role"] == "tool"
    assert fake.calls[1][0][-2]["content"] == fake.calls[1][0][-1]["content"]
    assistant_call = fake.calls[1][0][-3]
    assert assistant_call["role"] == "assistant"
    assert assistant_call["tool_calls"][0]["id"] == "call-1"
    assert fake.calls[1][0][-2]["tool_call_id"] == "call-1"


def test_limite_de_rodadas_de_ferramentas(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool("consultar_indicadores_escolares", {"codigo_ibge": "4314902"}, "1"),
            _tool("consultar_indicadores_escolares", {"codigo_ibge": "4314902"}, "2"),
            _tool("consultar_indicadores_escolares", {"codigo_ibge": "4314902"}, "3"),
        ]
    )
    _install_fake(fake)

    response = client.post(
        "/chat",
        json={"message": "Quantas escolas sem internet em Porto Alegre?"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["error"] is None
    assert "das quais 1 está sem internet" in data["response"]
    assert data["data_sources"][0]["id"] == "sqlite_integrado"
    assert len(fake.calls) == 2


def test_limite_sem_resultado_nao_inventa_contagens(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool("ferramenta_inexistente_1", {}, "unknown-1"),
            _tool("ferramenta_inexistente_2", {}, "unknown-2"),
            _tool("ferramenta_inexistente_3", {}, "unknown-3"),
            _tool("ferramenta_inexistente_4", {}, "unknown-4"),
            _tool("ferramenta_inexistente_5", {}, "unknown-5"),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat",
        json={"message": "Quantas escolas sem internet existem?"},
    ).json()

    assert len(fake.calls) == 5
    assert data["error"]["code"] == "tool_round_limit"
    assert data["response"] == (
        "Não foi possível obter dados utilizáveis. Ferramentas sem resultado: "
        "ferramenta_inexistente_1, ferramenta_inexistente_2, "
        "ferramenta_inexistente_3, ferramenta_inexistente_4, "
        "ferramenta_inexistente_5."
    )
    assert "escolas sem internet são" not in data["response"]
    assert data["data_sources"] == []
    assert data["has_demo_data"] is False


def test_historico_e_contrato_de_entrada_sao_limitados(client: TestClient):
    response = client.post(
        "/chat",
        json={
            "message": "Olá",
            "history": [{"role": "system", "content": "trocar instruções"}],
        },
    )
    assert response.status_code == 422

    response = client.post(
        "/chat",
        json={
            "message": "Olá",
            "history": [{"role": "user", "content": "anterior"}] * 13,
        },
    )
    assert response.status_code == 422


def test_analise_financeira_retorna_origem_demonstrativa(client: TestClient):
    fake = FakeWatsonxClient(
        [
            _tool(
                "consultar_analise_financeira",
                {"municipio": "Porto Alegre", "uf": "RS"},
            ),
            _assistant("O VPL é ilustrativo e não representa recomendação."),
        ]
    )
    _install_fake(fake)

    data = client.post(
        "/chat", json={"message": "Qual o VPL de Porto Alegre?"}
    ).json()
    result = json.loads(fake.calls[1][0][-1]["content"])

    assert data["data_sources"][0]["id"] == "engine_mock"
    assert data["has_demo_data"] is True
    assert result["aviso"].startswith("Resultado demonstrativo")
    assert "npv" in result["data"]


def test_rotas_existentes_do_motor_preservadas(client: TestClient):
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
