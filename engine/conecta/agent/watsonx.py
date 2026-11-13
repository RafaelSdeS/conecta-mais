"""Cliente mínimo para IBM watsonx.ai usando somente a biblioteca padrão."""

from __future__ import annotations

import json
import logging
import os
import socket
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)
DEFAULT_MAX_TOKENS = 1024
MAX_CONFIGURED_MAX_TOKENS = 8192


class WatsonxError(RuntimeError):
    status_code = 502
    error_code = "watsonx_unavailable"
    public_message = "O serviço IBM watsonx.ai está indisponível."


class WatsonxRequestError(WatsonxError):
    error_code = "watsonx_invalid_request"
    public_message = "O serviço IBM watsonx.ai rejeitou a requisição."


class WatsonxConfigurationError(WatsonxError):
    status_code = 503
    error_code = "watsonx_not_configured"
    public_message = "A configuração do serviço IBM watsonx.ai está incompleta ou inválida."


class WatsonxAuthenticationError(WatsonxError):
    error_code = "watsonx_authentication_failed"
    public_message = "A autenticação com IBM watsonx.ai falhou."


class WatsonxPermissionError(WatsonxError):
    error_code = "watsonx_permission_denied"
    public_message = "A configuração não tem permissão para acessar o serviço IBM."


class WatsonxModelUnavailableError(WatsonxError):
    error_code = "watsonx_model_unavailable"
    public_message = "O modelo configurado não está disponível no serviço IBM."


class WatsonxUnavailableError(WatsonxError):
    status_code = 503
    error_code = "watsonx_temporarily_unavailable"
    public_message = "O serviço IBM watsonx.ai está temporariamente indisponível."


class WatsonxTimeoutError(WatsonxError):
    status_code = 504
    error_code = "watsonx_timeout"
    public_message = "O serviço IBM watsonx.ai excedeu o tempo limite."


class WatsonxInvalidResponseError(WatsonxError):
    error_code = "watsonx_invalid_response"
    public_message = "O serviço IBM watsonx.ai retornou uma resposta inválida."


class WatsonxIncompleteResponseError(WatsonxError):
    error_code = "watsonx_incomplete_response"
    public_message = "O serviço IBM watsonx.ai encerrou a resposta antes de concluí-la."


@dataclass(frozen=True)
class WatsonxConfig:
    api_key: str
    project_id: str
    url: str
    model_id: str
    max_tokens: int = DEFAULT_MAX_TOKENS

    @classmethod
    def from_environment(cls) -> WatsonxConfig:
        api_key = os.getenv("WATSONX_APIKEY", "").strip()
        project_id = os.getenv("WATSONX_PROJECT_ID", "").strip()
        url = os.getenv("WATSONX_URL", "").strip().rstrip("/")
        model_id = os.getenv("WATSONX_MODEL_ID", "").strip()
        max_tokens_value = os.getenv(
            "WATSONX_MAX_TOKENS", str(DEFAULT_MAX_TOKENS)
        ).strip()
        if not all((api_key, project_id, url, model_id)):
            raise WatsonxConfigurationError
        if urlsplit(url).scheme != "https" or not urlsplit(url).netloc:
            raise WatsonxConfigurationError
        try:
            max_tokens = int(max_tokens_value)
        except ValueError as exc:
            raise WatsonxConfigurationError from exc
        if not 1 <= max_tokens <= MAX_CONFIGURED_MAX_TOKENS:
            raise WatsonxConfigurationError
        return cls(api_key, project_id, url, model_id, max_tokens)


class WatsonxClient:
    def __init__(self, timeout_seconds: float = 90.0):
        self.timeout_seconds = timeout_seconds

    def _post(
        self,
        url: str,
        body: bytes,
        headers: dict[str, str],
        *,
        timeout_seconds: float | None = None,
    ) -> dict:
        request = Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", **headers},
            method="POST",
        )
        try:
            timeout = (
                self.timeout_seconds
                if timeout_seconds is None
                else timeout_seconds
            )
            with urlopen(request, timeout=timeout) as response:
                body = response.read(2_000_001)
        except HTTPError as exc:
            logger.warning("watsonx_http_error status=%d", exc.code)
            if exc.code == 401:
                raise WatsonxAuthenticationError from exc
            if exc.code == 403:
                raise WatsonxPermissionError from exc
            if exc.code == 400:
                if url.endswith("/identity/token"):
                    raise WatsonxAuthenticationError from exc
                raise WatsonxRequestError from exc
            if exc.code == 404 and "/ml/v1/text/chat" in url:
                raise WatsonxModelUnavailableError from exc
            if exc.code in (408, 504):
                raise WatsonxTimeoutError from exc
            if exc.code == 429 or exc.code >= 500:
                raise WatsonxUnavailableError from exc
            raise WatsonxError from exc
        except (TimeoutError, socket.timeout) as exc:
            logger.warning("watsonx_request_timeout")
            raise WatsonxTimeoutError from exc
        except URLError as exc:
            if isinstance(exc.reason, (TimeoutError, socket.timeout)):
                logger.warning("watsonx_request_timeout")
                raise WatsonxTimeoutError from exc
            logger.warning("watsonx_network_unavailable")
            raise WatsonxUnavailableError from exc
        except OSError as exc:
            logger.warning("watsonx_network_unavailable")
            raise WatsonxUnavailableError from exc

        if len(body) > 2_000_000:
            raise WatsonxInvalidResponseError
        try:
            result = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise WatsonxInvalidResponseError from exc
        if not isinstance(result, dict):
            raise WatsonxInvalidResponseError
        return result

    def _post_json(self, url: str, payload: dict, headers: dict[str, str]) -> dict:
        return self._post(
            url,
            json.dumps(payload).encode("utf-8"),
            headers,
        )

    def _access_token(self, config: WatsonxConfig) -> str:
        form = urlencode(
            {
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": config.api_key,
            }
        ).encode("ascii")
        response = self._post(
            "https://iam.cloud.ibm.com/identity/token",
            form,
            {"Content-Type": "application/x-www-form-urlencoded"},
            timeout_seconds=30.0,
        )

        token = response.get("access_token")
        if not isinstance(token, str) or not token:
            raise WatsonxInvalidResponseError
        return token

    def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float | None = None,
    ) -> dict:
        config = WatsonxConfig.from_environment()
        token = self._access_token(config)
        payload: dict = {
            "model_id": config.model_id,
            "project_id": config.project_id,
            "messages": messages,
            "max_tokens": config.max_tokens,
            "time_limit": 30_000,
        }
        if temperature is not None:
            payload["temperature"] = temperature
        # Granite rejeita tools=[] com json_validation_error; omitir quando vazio
        if tools:
            payload["tools"] = tools
            payload["tool_choice_option"] = "auto"
        response = self._post_json(
            f"{config.url}/ml/v1/text/chat?version=2024-10-08",
            payload,
            {"Authorization": f"Bearer {token}"},
        )

        try:
            choices = response["choices"]
            choice = choices[0]
            message = choice["message"]
            finish_reason = choice["finish_reason"]
        except (KeyError, IndexError, TypeError) as exc:
            raise WatsonxInvalidResponseError from exc
        if (
            not isinstance(message, dict)
            or message.get("role") != "assistant"
            or not isinstance(finish_reason, str)
            or not finish_reason
        ):
            raise WatsonxInvalidResponseError
        if message.get("tool_calls") is not None and not isinstance(
            message["tool_calls"], list
        ):
            raise WatsonxInvalidResponseError
        if message.get("content") is not None and not isinstance(
            message["content"], str
        ):
            raise WatsonxInvalidResponseError
        tool_calls = message.get("tool_calls") or []
        if (finish_reason == "tool_calls") != bool(tool_calls):
            raise WatsonxInvalidResponseError
        if finish_reason in {"length", "max_tokens"}:
            logger.warning(
                "watsonx_generation_incomplete finish_reason=%s max_tokens=%d",
                finish_reason,
                config.max_tokens,
            )
            return {**message, "finish_reason": finish_reason}
        if finish_reason in {"max_time", "time_limit"}:
            logger.warning(
                "watsonx_generation_timeout finish_reason=%s",
                finish_reason,
            )
            raise WatsonxTimeoutError
        if finish_reason in {"error", "cancelled"}:
            raise WatsonxError
        if finish_reason not in {"stop", "stop_sequence", "eos_token", "tool_calls"}:
            raise WatsonxInvalidResponseError

        return {**message, "finish_reason": finish_reason}
