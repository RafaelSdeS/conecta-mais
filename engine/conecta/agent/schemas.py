"""Contratos da API de chat e do histórico limitado."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatHistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4_000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4_000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=12)


class DataSource(BaseModel):
    id: Literal["sqlite_integrado", "engine_mock", "rag_tecnico"]
    tipo: Literal["real", "demonstrativo", "documental"]
    descricao: str


class ToolExecution(BaseModel):
    name: str
    status: Literal["success", "not_found", "failed", "cached"]


class ChatError(BaseModel):
    code: str
    message: str


class DocumentReference(BaseModel):
    title: str
    source_path: str
    section: str
    line_start: int = Field(ge=1)
    line_end: int = Field(ge=1)
    document_type: str
    is_official: bool


class ChatResponse(BaseModel):
    response: str | None
    history: list[ChatHistoryMessage] = Field(max_length=12)
    data_sources: list[DataSource]
    tools_executed: list[ToolExecution]
    has_demo_data: bool
    references: list[DocumentReference] = Field(default_factory=list)
    error: ChatError | None = None
