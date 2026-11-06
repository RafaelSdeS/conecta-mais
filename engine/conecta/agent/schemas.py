"""Contratos da API de chat e do histórico limitado."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from conecta.data.escopo import Regiao
from conecta.financial.models import Alavancas, FinancialParams


class ChatHistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4_000)


class ChatContext(BaseModel):
    """Estado da tela do usuário; entra no prompt como dado, nunca como instrução."""

    model_config = ConfigDict(extra="forbid")

    pagina: str | None = Field(default=None, max_length=40)
    municipio_id: str | None = Field(default=None, pattern=r"^\d{7}$")
    municipio_nome: str | None = Field(default=None, max_length=100)
    orcamento_mi: float | None = Field(default=None, ge=0, le=1_000_000)
    quadrante: str | None = Field(default=None, max_length=4)
    busca: str | None = Field(default=None, max_length=100)
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    regiao: Regiao | None = None
    semiarido: bool | None = None
    objetivo: Literal["retorno", "equilibrado", "alunos"] | None = None
    # Cenário ativo na tela: as ferramentas calculam com as mesmas alavancas e premissas.
    alavancas: Alavancas | None = None
    premissas: FinancialParams | None = None


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4_000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=12)
    context: ChatContext | None = None


class DataSource(BaseModel):
    id: Literal["sqlite_integrado", "engine", "engine_mock", "rag_tecnico"]
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


class AcaoPainel(BaseModel):
    """Ação de um clique proposta ao usuário, montada pelo código a partir do motor.

    Nunca vem do texto do modelo.

    Campos None mantêm o que está na tela; "" em uf ou regiao limpa o filtro.
    """

    tipo: Literal["aplicar_cenario", "abrir_municipio"]
    rotulo: str = Field(max_length=160)
    orcamento_mi: float | None = None
    objetivo: Literal["retorno", "equilibrado", "alunos"] | None = None
    uf: str | None = None
    regiao: str | None = None
    semiarido: bool | None = None
    alavancas: Alavancas | None = None
    id_municipio: str | None = None


class ChatResponse(BaseModel):
    response: str | None
    history: list[ChatHistoryMessage] = Field(max_length=12)
    data_sources: list[DataSource]
    tools_executed: list[ToolExecution]
    has_demo_data: bool
    references: list[DocumentReference] = Field(default_factory=list)
    acoes: list[AcaoPainel] = Field(default_factory=list)
    error: ChatError | None = None
