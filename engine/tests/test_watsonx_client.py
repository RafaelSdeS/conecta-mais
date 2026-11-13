"""Testes unitários da tradução de erros do cliente watsonx.ai."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError

import pytest

from conecta.agent.watsonx import (
    WatsonxAuthenticationError,
    WatsonxClient,
    WatsonxConfig,
    WatsonxConfigurationError,
    WatsonxInvalidResponseError,
    WatsonxModelUnavailableError,
    WatsonxPermissionError,
    WatsonxRequestError,
    WatsonxTimeoutError,
    WatsonxUnavailableError,
)


def _config() -> WatsonxConfig:
    return WatsonxConfig(
        api_key="synthetic-key",
        project_id="synthetic-project",
        url="https://example.test",
        model_id="ibm/granite-4-h-small",
    )


def test_configuracao_exige_variaveis(monkeypatch: pytest.MonkeyPatch):
    for name in (
        "WATSONX_APIKEY",
        "WATSONX_PROJECT_ID",
        "WATSONX_URL",
        "WATSONX_MODEL_ID",
    ):
        monkeypatch.delenv(name, raising=False)

    with pytest.raises(WatsonxConfigurationError):
        WatsonxConfig.from_environment()


def test_url_de_watsonx_exige_https(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WATSONX_APIKEY", "synthetic-key")
    monkeypatch.setenv("WATSONX_PROJECT_ID", "synthetic-project")
    monkeypatch.setenv("WATSONX_URL", "http://example.test")
    monkeypatch.setenv("WATSONX_MODEL_ID", "ibm/granite-4-h-small")

    with pytest.raises(WatsonxConfigurationError):
        WatsonxConfig.from_environment()


def test_iam_usa_formulario_e_nao_expoe_chave(monkeypatch: pytest.MonkeyPatch):
    observed = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self, _limit):
            return json.dumps({"access_token": "synthetic-token"}).encode()

    def fake_urlopen(request, timeout):
        observed["url"] = request.full_url
        observed["content_type"] = request.get_header("Content-type")
        observed["body"] = request.data.decode()
        observed["timeout"] = timeout
        return Response()

    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)
    token = WatsonxClient()._access_token(_config())

    assert token == "synthetic-token"
    assert observed["url"] == "https://iam.cloud.ibm.com/identity/token"
    assert observed["content_type"] == "application/x-www-form-urlencoded"
    assert observed["timeout"] == 30.0
    assert (
        "grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey"
        in observed["body"]
    )
    assert "apikey=synthetic-key" in observed["body"]


def test_chat_envia_modelo_configurado_e_bearer_token(
    monkeypatch: pytest.MonkeyPatch,
):
    observed = {}

    class Response:
        def __init__(self, body: dict):
            self.body = json.dumps(body).encode()

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self, _limit):
            return self.body

    responses = [
        {"access_token": "synthetic-token"},
        {
            "choices": [
                {
                    "message": {"role": "assistant", "content": "Olá"},
                    "finish_reason": "stop",
                }
            ]
        },
    ]

    def fake_urlopen(request, timeout):
        observed[request.full_url] = {
            "authorization": request.get_header("Authorization"),
            "payload": json.loads(request.data) if "text/chat" in request.full_url else {},
            "timeout": timeout,
        }
        return Response(responses.pop(0))

    monkeypatch.setenv("WATSONX_APIKEY", "synthetic-key")
    monkeypatch.setenv("WATSONX_PROJECT_ID", "synthetic-project")
    monkeypatch.setenv("WATSONX_URL", "https://example.test")
    monkeypatch.setenv("WATSONX_MODEL_ID", "ibm/granite-4-h-small")
    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)

    message = WatsonxClient().chat(
        [{"role": "user", "content": "Olá"}],
        [],
    )

    assert message["content"] == "Olá"
    chat_request = observed["https://example.test/ml/v1/text/chat?version=2024-10-08"]
    assert chat_request["authorization"] == "Bearer synthetic-token"
    assert chat_request["timeout"] == 90.0
    assert "tool_choice_option" not in chat_request["payload"]
    assert "tools" not in chat_request["payload"]
    assert chat_request["payload"]["model_id"] == "ibm/granite-4-h-small"
    assert chat_request["payload"]["project_id"] == "synthetic-project"
    assert chat_request["payload"]["max_tokens"] == 1024
    assert chat_request["payload"]["time_limit"] == 30_000
    assert "parameters" not in chat_request["payload"]
    assert "temperature" not in chat_request["payload"]  # o chat usa a temperatura padrão
    assert message["finish_reason"] == "stop"


def test_chat_aceita_orcamento_maior_configurado(monkeypatch: pytest.MonkeyPatch):
    observed_payloads = []
    responses = [
        {"access_token": "synthetic-token"},
        {
            "choices": [
                {
                    "message": {"role": "assistant", "content": "Resposta completa."},
                    "finish_reason": "stop",
                }
            ]
        },
    ]

    def fake_urlopen(request, timeout):
        if "text/chat" in request.full_url:
            observed_payloads.append(json.loads(request.data))
        return _Response(responses.pop(0))

    _set_watsonx_environment(monkeypatch)
    monkeypatch.setenv("WATSONX_MAX_TOKENS", "2048")
    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)

    message = WatsonxClient().chat([], [])

    assert message["finish_reason"] == "stop"
    assert message["content"] == "Resposta completa."
    assert observed_payloads[0]["max_tokens"] == 2048


def test_limite_de_tokens_ausente_usa_padrao(monkeypatch: pytest.MonkeyPatch):
    _set_watsonx_environment(monkeypatch)
    monkeypatch.delenv("WATSONX_MAX_TOKENS", raising=False)

    config = WatsonxConfig.from_environment()

    assert config.max_tokens == 1024


@pytest.mark.parametrize("value", ["not-a-number", "0", "8193"])
def test_limite_de_tokens_invalido_rejeita_configuracao(
    value: str, monkeypatch: pytest.MonkeyPatch
):
    _set_watsonx_environment(monkeypatch)
    monkeypatch.setenv("WATSONX_MAX_TOKENS", value)

    with pytest.raises(WatsonxConfigurationError):
        WatsonxConfig.from_environment()


def test_chat_envia_tool_call_no_contrato_e_preserva_finish_reason(
    monkeypatch: pytest.MonkeyPatch,
):
    tool_call = {
        "id": "call-synthetic",
        "type": "function",
        "function": {
            "name": "buscar_municipio_real",
            "arguments": '{"municipio":"Porto Alegre","uf":"RS"}',
        },
    }
    responses = [
        {"access_token": "synthetic-token"},
        {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [tool_call],
                    },
                    "finish_reason": "tool_calls",
                }
            ]
        },
    ]
    observed_payloads = []

    def fake_urlopen(request, timeout):
        if "text/chat" in request.full_url:
            observed_payloads.append(json.loads(request.data))
        return _Response(responses.pop(0))

    _set_watsonx_environment(monkeypatch)
    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)
    history_messages = [
        {"role": "user", "content": "Localize Porto Alegre"},
        {"role": "assistant", "content": None, "tool_calls": [tool_call]},
        {
            "role": "tool",
            "tool_call_id": "call-synthetic",
            "content": '{"ok":true}',
        },
    ]
    tools = [
        {
            "type": "function",
            "function": {
                "name": "buscar_municipio_real",
                "description": "Localiza município.",
                "parameters": {"type": "object"},
            },
        }
    ]

    message = WatsonxClient().chat(history_messages, tools)

    assert message["tool_calls"] == [tool_call]
    assert message["finish_reason"] == "tool_calls"
    assert observed_payloads[0]["messages"] == history_messages
    assert observed_payloads[0]["tools"] == tools


class _Response:
    def __init__(self, body: dict):
        self.body = json.dumps(body).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, _limit):
        return self.body


def _set_watsonx_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WATSONX_APIKEY", "synthetic-key")
    monkeypatch.setenv("WATSONX_PROJECT_ID", "synthetic-project")
    monkeypatch.setenv("WATSONX_URL", "https://example.test")
    monkeypatch.setenv("WATSONX_MODEL_ID", "ibm/granite-4-h-small")


def test_iam_401_e_mapeado_para_falha_de_autenticacao(monkeypatch: pytest.MonkeyPatch):
    def fake_urlopen(*_args, **_kwargs):
        raise HTTPError("https://iam.cloud.ibm.com/identity/token", 401, "", {}, None)

    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)

    with pytest.raises(WatsonxAuthenticationError):
        WatsonxClient()._access_token(_config())


def test_iam_400_e_mapeado_como_credencial_rejeitada(
    monkeypatch: pytest.MonkeyPatch,
):
    def fake_urlopen(*_args, **_kwargs):
        raise HTTPError(
            "https://iam.cloud.ibm.com/identity/token", 400, "", {}, None
        )

    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)

    with pytest.raises(WatsonxAuthenticationError):
        WatsonxClient()._access_token(_config())


@pytest.mark.parametrize(
    ("status_code", "url", "error_type"),
    [
        (400, "https://example.test/ml/v1/text/chat", WatsonxRequestError),
        (403, "https://example.test/ml/v1/text/chat", WatsonxPermissionError),
        (
            404,
            "https://example.test/ml/v1/text/chat",
            WatsonxModelUnavailableError,
        ),
        (429, "https://example.test/ml/v1/text/chat", WatsonxUnavailableError),
        (503, "https://example.test/ml/v1/text/chat", WatsonxUnavailableError),
    ],
)
def test_erros_http_sao_classificados_sem_expor_resposta(
    status_code: int,
    url: str,
    error_type: type[Exception],
    monkeypatch: pytest.MonkeyPatch,
):
    def fake_urlopen(*_args, **_kwargs):
        raise HTTPError(url, status_code, "synthetic error", {}, None)

    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)

    with pytest.raises(error_type) as exc_info:
        WatsonxClient()._post(url, b"{}", {})

    assert "synthetic error" not in str(exc_info.value)


def test_finish_reason_deve_corresponder_a_chamada_de_ferramenta(
    monkeypatch: pytest.MonkeyPatch,
):
    responses = [
        {"access_token": "synthetic-token"},
        {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call-synthetic",
                                "type": "function",
                                "function": {"name": "x", "arguments": "{}"},
                            }
                        ],
                    },
                    "finish_reason": "stop",
                }
            ]
        },
    ]
    _set_watsonx_environment(monkeypatch)
    monkeypatch.setattr(
        "conecta.agent.watsonx.urlopen",
        lambda *_args, **_kwargs: _Response(responses.pop(0)),
    )

    with pytest.raises(WatsonxInvalidResponseError):
        WatsonxClient().chat([], [])


@pytest.mark.parametrize("finish_reason", ["length", "max_tokens"])
def test_finish_reason_truncado_preserva_resposta_para_erro_estruturado(
    finish_reason: str,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    responses = [
        {"access_token": "synthetic-token"},
        {
            "choices": [
                {
                    "message": {"role": "assistant", "content": "resposta parcial"},
                    "finish_reason": finish_reason,
                }
            ]
        },
    ]
    _set_watsonx_environment(monkeypatch)
    monkeypatch.setattr(
        "conecta.agent.watsonx.urlopen",
        lambda *_args, **_kwargs: _Response(responses.pop(0)),
    )

    message = WatsonxClient().chat([], [])

    assert message["content"] == "resposta parcial"
    assert message["finish_reason"] == finish_reason
    assert "watsonx_generation_incomplete" in caplog.text
    assert finish_reason in caplog.text
    assert "1024" in caplog.text
    assert "resposta parcial" not in caplog.text


@pytest.mark.parametrize("finish_reason", ["max_time", "time_limit"])
def test_finish_reason_de_tempo_e_mapeado_para_timeout(
    finish_reason: str, monkeypatch: pytest.MonkeyPatch
):
    responses = [
        {"access_token": "synthetic-token"},
        {
            "choices": [
                {
                    "message": {"role": "assistant", "content": "parcial"},
                    "finish_reason": finish_reason,
                }
            ]
        },
    ]
    _set_watsonx_environment(monkeypatch)
    monkeypatch.setattr(
        "conecta.agent.watsonx.urlopen",
        lambda *_args, **_kwargs: _Response(responses.pop(0)),
    )

    with pytest.raises(WatsonxTimeoutError):
        WatsonxClient().chat([], [])


def test_timeout_e_mapeado_sem_envolver_chamada_real(monkeypatch: pytest.MonkeyPatch):
    def fake_urlopen(*_args, **_kwargs):
        raise URLError(TimeoutError("synthetic timeout"))

    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)

    with pytest.raises(WatsonxTimeoutError):
        WatsonxClient()._access_token(_config())


def test_indisponibilidade_de_rede_e_mapeada_sem_detalhes_sensiveis(
    monkeypatch: pytest.MonkeyPatch,
):
    def fake_urlopen(*_args, **_kwargs):
        raise URLError("synthetic network failure")

    monkeypatch.setattr("conecta.agent.watsonx.urlopen", fake_urlopen)

    with pytest.raises(WatsonxUnavailableError) as exc_info:
        WatsonxClient()._access_token(_config())

    assert "synthetic network failure" not in str(exc_info.value)


def test_resposta_nao_json_e_rejeitada(monkeypatch: pytest.MonkeyPatch):
    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self, _limit):
            return b"not-json"

    monkeypatch.setattr(
        "conecta.agent.watsonx.urlopen",
        lambda *_args, **_kwargs: Response(),
    )

    with pytest.raises(WatsonxInvalidResponseError):
        WatsonxClient()._post_json("https://example.test", {}, {})
