"""Endpoint de chat do Conecta+ com IBM Granite e tool calling controlado."""

from __future__ import annotations

import time
from collections import deque
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from conecta.agent import audit
from conecta.agent.orchestrator import ChatOrchestrator
from conecta.agent.schemas import ChatError, ChatRequest, ChatResponse
from conecta.agent.watsonx import WatsonxClient, WatsonxError

router = APIRouter(tags=["chat"])


LIMITE_IA_POR_MINUTO = 30
_chamadas_ia: deque[float] = deque()
_trava_ia = Lock()


def get_watsonx_client() -> WatsonxClient:
    """Ponto único de /chat e /ia/*: cada uso pode gastar créditos do watsonx."""
    # ponytail: limite global por processo, para proteger os créditos; por IP se houver abuso real
    agora = time.monotonic()
    with _trava_ia:
        while _chamadas_ia and agora - _chamadas_ia[0] > 60:
            _chamadas_ia.popleft()
        if len(_chamadas_ia) >= LIMITE_IA_POR_MINUTO:
            raise HTTPException(status_code=429, detail="Muitas consultas à IA neste minuto. Aguarde e tente de novo.")
        _chamadas_ia.append(agora)
    return WatsonxClient()


@router.post("/chat", response_model=ChatResponse)
def post_chat(
    body: ChatRequest,
    request: Request,
    response: Response,
    client: WatsonxClient = Depends(get_watsonx_client),
) -> ChatResponse:
    inicio = time.monotonic()
    try:
        result = ChatOrchestrator(client).respond(
            body.message,
            body.history,
            request.app.state.municipios,
            body.context,
        )
        if result.error and result.error.code == "watsonx_incomplete_response":
            response.status_code = 502
        audit.registrar(
            "/chat",
            result.error is None,
            int((time.monotonic() - inicio) * 1000),
            ferramentas=[t.name for t in result.tools_executed],
            fontes=[d.id for d in result.data_sources],
            numeros_nao_confirmados=len(result.numeros_nao_confirmados),
        )
        return result
    except WatsonxError as exc:
        audit.registrar("/chat", False, int((time.monotonic() - inicio) * 1000), erro=exc.error_code)
        response.status_code = exc.status_code
        return ChatResponse(
            response=None,
            history=body.history,
            data_sources=[],
            tools_executed=[],
            has_demo_data=False,
            error=ChatError(code=exc.error_code, message=exc.public_message),
        )
