"""Endpoint de chat do Conecta+ com IBM Granite e tool calling controlado."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from conecta.agent.orchestrator import ChatOrchestrator
from conecta.agent.schemas import ChatError, ChatRequest, ChatResponse
from conecta.agent.watsonx import WatsonxClient, WatsonxError

router = APIRouter(tags=["chat"])


def get_watsonx_client() -> WatsonxClient:
    return WatsonxClient()


@router.post("/chat", response_model=ChatResponse)
def post_chat(
    body: ChatRequest,
    request: Request,
    response: Response,
    client: WatsonxClient = Depends(get_watsonx_client),
) -> ChatResponse:
    try:
        result = ChatOrchestrator(client).respond(
            body.message,
            body.history,
            request.app.state.municipios,
        )
        if result.error and result.error.code == "watsonx_incomplete_response":
            response.status_code = 502
        return result
    except WatsonxError as exc:
        response.status_code = exc.status_code
        return ChatResponse(
            response=None,
            history=body.history,
            data_sources=[],
            tools_executed=[],
            has_demo_data=False,
            error=ChatError(code=exc.error_code, message=exc.public_message),
        )
