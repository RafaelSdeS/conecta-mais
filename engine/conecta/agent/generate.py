"""Geração de texto de uma só rodada (sem ferramentas) sobre dados já calculados pelo motor."""

from __future__ import annotations

import json

from conecta.agent.watsonx import (
    WatsonxClient,
    WatsonxIncompleteResponseError,
    WatsonxInvalidResponseError,
)


def gerar(client: WatsonxClient, sistema: str, dados: dict) -> str:
    """Pede ao Granite um texto a partir de `dados` (tratados como dados, não instruções).

    Temperatura 0: o texto reescreve números do motor, então vale a resposta mais provável e
    estável; com amostragem, o modelo trocava sentidos e inventava valores.
    """
    reply = client.chat(
        [
            {"role": "system", "content": sistema},
            {"role": "user", "content": json.dumps(dados, ensure_ascii=False, allow_nan=False)},
        ],
        None,
        temperature=0,
    )
    content = reply.get("content")
    if reply.get("finish_reason") in {"length", "max_tokens"}:
        raise WatsonxIncompleteResponseError
    if not isinstance(content, str) or not content.strip():
        raise WatsonxInvalidResponseError
    return content.strip()
