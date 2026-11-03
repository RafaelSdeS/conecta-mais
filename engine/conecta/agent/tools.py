"""Definições e execução controlada das ferramentas do agente."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections.abc import Callable
from typing import Any, Literal

import pandas as pd
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

from conecta.data.sqlite_repository import (
    SQLiteDataRepository,
    SQLiteDataUnavailable,
)
from conecta.financial.calculator import business_case
from conecta.financial.models import Alavancas, FinancialParams
from conecta.rag.retriever import RAGIndexUnavailable, search_documents


class ToolArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MunicipalityArguments(ToolArguments):
    municipio: str = Field(min_length=1, max_length=100)
    uf: str = Field(min_length=2, max_length=2)

    @field_validator("municipio")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = re.sub(r",\s*[A-Za-z]{2}$", "", value.strip())
        value = " ".join(value.split())
        if not value:
            raise ValueError("Nome do município não pode estar vazio.")
        return value

    @field_validator("uf")
    @classmethod
    def normalize_uf(cls, value: str) -> str:
        return value.strip().upper()


class MunicipalityReferenceArguments(ToolArguments):
    codigo_ibge: str | None = Field(
        default=None,
        pattern=r"^\d{7}$",
        description="Código IBGE de 7 dígitos, se já conhecido.",
    )
    municipio: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Nome do município, se o código IBGE não for conhecido.",
    )
    uf: str | None = Field(
        default=None,
        min_length=2,
        max_length=2,
        description="UF obrigatória quando municipio for informado.",
    )

    @field_validator("municipio")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = re.sub(r",\s*[A-Za-z]{2}$", "", value.strip())
        value = " ".join(value.split())
        if not value:
            raise ValueError("Nome do município não pode estar vazio.")
        return value

    @field_validator("uf")
    @classmethod
    def normalize_uf(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None

    @model_validator(mode="after")
    def validate_identity(self) -> MunicipalityReferenceArguments:
        if self.codigo_ibge:
            if self.municipio is not None or self.uf is not None:
                raise ValueError("Informe código IBGE ou município e UF, não ambos.")
        elif self.municipio is None or self.uf is None:
            raise ValueError("Informe código IBGE ou município e UF.")
        return self


class IBGEArguments(ToolArguments):
    codigo_ibge: str = Field(pattern=r"^\d{7}$")


class SchoolListArguments(MunicipalityReferenceArguments):
    limite: int = Field(default=5, ge=1, le=20)


class SchoolWithoutInternetArguments(MunicipalityReferenceArguments):
    limite: int = Field(default=20, ge=1, le=20)
    offset: int = Field(default=0, ge=0, le=1_000_000)


class EngineMunicipalityArguments(MunicipalityReferenceArguments):
    pass


class DocumentationSearchArguments(ToolArguments):
    pergunta: str = Field(min_length=2, max_length=500)


_REFERENCE_DESCRIPTION = (
    "Identifique o município com codigo_ibge de 7 dígitos ou, se não o conhecer, "
    "informe municipio e uf."
)


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "buscar_municipio_real",
            "description": "Localiza um município na base integrada real usando nome e UF.",
            "parameters": MunicipalityArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_indicadores_escolares",
            "description": "Consulta indicadores reais e validação geográfica pelo código IBGE.",
            "parameters": IBGEArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_escolas_municipio",
            "description": (
                "Lista escolas reais de um município (padrão: 5, máximo: 20). "
                "Não informe o campo 'limite' a menos que o usuário peça um número específico — "
                "use o padrão. "
                f"{_REFERENCE_DESCRIPTION}"
            ),
            "parameters": SchoolListArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "listar_escolas_sem_internet",
            "description": (
                "Lista escolas reais sem internet de um município (padrão: 20, máximo: 20). "
                "Não informe o campo 'limite' a menos que o usuário peça um número específico. "
                f"{_REFERENCE_DESCRIPTION}"
            ),
            "parameters": SchoolWithoutInternetArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_scores_municipio",
            "description": (
                "Consulta scores já calculados pelo engine demonstrativo. "
                f"{_REFERENCE_DESCRIPTION}"
            ),
            "parameters": EngineMunicipalityArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_analise_financeira",
            "description": (
                "Calcula o business case demonstrativo existente para município do engine. "
                f"{_REFERENCE_DESCRIPTION}"
            ),
            "parameters": EngineMunicipalityArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_documentacao_conecta",
            "description": (
                "Recupera trechos da documentação interna e do código implementado "
                "para explicar dimensões, pesos, fórmulas, quadrantes, CapEx, "
                "payback, VPL, otimização e limitações. Use para perguntas "
                "conceituais; as fontes disponíveis não são normas oficiais e "
                "não comprovam elegibilidade regulatória."
            ),
            "parameters": DocumentationSearchArguments.model_json_schema(),
        },
    },
]

_SQLITE_SOURCE = {
    "id": "sqlite_integrado",
    "tipo": "real",
    "descricao": "Dados integrados do SQLite (IBGE, INEP, Anatel e NIC.br).",
}
_ENGINE_SOURCE = {
    "id": "engine_mock",
    "tipo": "demonstrativo",
    "descricao": "Motor de scores e financeiro calculado sobre CSVs demonstrativos.",
}
_RAG_SOURCE = {
    "id": "rag_tecnico",
    "tipo": "documental",
    "descricao": (
        "Documentação interna e código-fonte do Conecta+; não constitui "
        "documentação regulatória oficial."
    ),
}
_TOOLS_BY_NAME = {
    tool["function"]["name"]: tool["function"] for tool in TOOL_DEFINITIONS
}
_ARGUMENT_MODELS: dict[str, type[ToolArguments]] = {
    "buscar_municipio_real": MunicipalityArguments,
    "consultar_indicadores_escolares": IBGEArguments,
    "listar_escolas_municipio": SchoolListArguments,
    "listar_escolas_sem_internet": SchoolWithoutInternetArguments,
    "consultar_scores_municipio": EngineMunicipalityArguments,
    "consultar_analise_financeira": EngineMunicipalityArguments,
    "consultar_documentacao_conecta": DocumentationSearchArguments,
}


def _normalize_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_accents = "".join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    return " ".join(without_accents.casefold().split())


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if hasattr(value, "item"):
        return _json_safe(value.item())
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _sqlite_municipality(
    repository: SQLiteDataRepository, args: MunicipalityReferenceArguments
) -> dict | None:
    if args.codigo_ibge is not None:
        return repository.get_municipio(args.codigo_ibge)

    assert args.municipio is not None and args.uf is not None
    _, rows = repository.list_municipios(args.municipio, args.uf, 100, 0)
    matches = [
        row
        for row in rows
        if _normalize_name(row["municipio"]) == _normalize_name(args.municipio)
        and row["uf"].upper() == args.uf
    ]
    return matches[0] if len(matches) == 1 else None


def _engine_municipality(
    municipios: pd.DataFrame, args: EngineMunicipalityArguments
) -> pd.Series | None:
    if args.codigo_ibge is not None:
        matches = municipios[
            municipios["id_municipio"].astype(str).str.strip().eq(args.codigo_ibge)
        ]
        return matches.iloc[0] if len(matches) == 1 else None

    assert args.municipio is not None and args.uf is not None
    matches = municipios[
        municipios["nome"].map(_normalize_name).eq(_normalize_name(args.municipio))
        & municipios["uf"].str.upper().eq(args.uf)
    ]
    return matches.iloc[0] if len(matches) == 1 else None


def _source_result(source: dict, data: dict, **extra: Any) -> dict:
    return {
        "ok": True,
        "source": source,
        "data": _json_safe(data),
        **extra,
    }


def _not_found(source: dict, message: str) -> dict:
    return {
        "ok": False,
        "source": source,
        "error": {"code": "not_found", "message": message},
    }


class ToolDispatcher:
    def __init__(self, repository_factory: Callable[[], SQLiteDataRepository] | None = None):
        self._repository_factory = repository_factory or SQLiteDataRepository

    def dispatch(
        self,
        name: str,
        raw_arguments: str | dict,
        municipios: pd.DataFrame,
    ) -> tuple[dict, Literal["success", "not_found", "failed"]]:
        if name not in _TOOLS_BY_NAME:
            return (
                {
                    "ok": False,
                    "error": {
                        "code": "unknown_tool",
                        "message": "Ferramenta solicitada não está disponível.",
                    },
                },
                "failed",
            )

        try:
            if isinstance(raw_arguments, str):
                if len(raw_arguments) > 4_000:
                    raise ValueError("Argumentos excedem o limite permitido.")
                arguments = json.loads(raw_arguments)
            else:
                arguments = raw_arguments
            args = _ARGUMENT_MODELS[name].model_validate(arguments)
        except (json.JSONDecodeError, ValidationError, ValueError, TypeError):
            return (
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_arguments",
                        "message": "Argumentos inválidos para a ferramenta solicitada.",
                    },
                },
                "failed",
            )

        try:
            result, status = self._execute(name, args, municipios)
        except SQLiteDataUnavailable:
            return (
                {
                    "ok": False,
                    "source": _SQLITE_SOURCE,
                    "error": {
                        "code": "sqlite_unavailable",
                        "message": "Os dados integrados do SQLite estão indisponíveis.",
                    },
                },
                "failed",
            )
        except RAGIndexUnavailable:
            return (
                {
                    "ok": False,
                    "source": _RAG_SOURCE,
                    "error": {
                        "code": "rag_index_unavailable",
                        "message": (
                            "O índice da documentação local está ausente ou "
                            "indisponível. Atualize-o com o comando documentado."
                        ),
                    },
                },
                "failed",
            )
        return result, status

    def _execute(
        self,
        name: str,
        args: ToolArguments,
        municipios: pd.DataFrame,
    ) -> tuple[dict, Literal["success", "not_found"]]:
        if name == "consultar_documentacao_conecta":
            assert isinstance(args, DocumentationSearchArguments)
            result = search_documents(args.pergunta)
            return _source_result(_RAG_SOURCE, result), "success"

        if name == "buscar_municipio_real":
            assert isinstance(args, MunicipalityArguments)
            municipality = _sqlite_municipality(
                self._repository_factory(),
                MunicipalityReferenceArguments(
                    municipio=args.municipio,
                    uf=args.uf,
                ),
            )
            if municipality is None:
                return (
                    _not_found(
                        _SQLITE_SOURCE,
                        "Município não encontrado de forma única na base integrada.",
                    ),
                    "not_found",
                )
            return _source_result(
                _SQLITE_SOURCE,
                {
                    "codigo_ibge": municipality["codigo_ibge"],
                    "municipio": municipality["municipio"],
                    "uf": municipality["uf"],
                },
            ), "success"

        if name == "consultar_indicadores_escolares":
            assert isinstance(args, IBGEArguments)
            result = self._repository_factory().get_indicadores(args.codigo_ibge)
            if result is None:
                return (
                    _not_found(
                        _SQLITE_SOURCE, "Município não encontrado na base integrada."
                    ),
                    "not_found",
                )
            return _source_result(_SQLITE_SOURCE, result), "success"

        if name in {"listar_escolas_municipio", "listar_escolas_sem_internet"}:
            assert isinstance(args, (SchoolListArguments, SchoolWithoutInternetArguments))
            repository = self._repository_factory()
            municipality = _sqlite_municipality(repository, args)
            if municipality is None:
                return (
                    _not_found(
                        _SQLITE_SOURCE,
                        "Município não encontrado de forma única na base integrada.",
                    ),
                    "not_found",
                )

            if name == "listar_escolas_municipio":
                total, rows = repository.list_escolas(
                    municipality["codigo_ibge"], None, args.limite, 0
                )
                schools = [
                    {
                        "codigo_inep": row["CO_ENTIDADE"],
                        "escola": row["NO_ENTIDADE"],
                        "municipio": row["NO_MUNICIPIO"],
                        "uf": row["SG_UF"],
                        "possui_internet": row["IN_INTERNET"],
                        "latitude": row.get("latitude"),
                        "longitude": row.get("longitude"),
                        "status_localizacao": row.get("status_localizacao"),
                    }
                    for row in rows
                ]
                return _source_result(
                    _SQLITE_SOURCE,
                    {
                        "municipio": municipality["municipio"],
                        "uf": municipality["uf"],
                        "escolas": schools,
                    },
                    total=total,
                    total_retornado=len(schools),
                ), "success"

            assert isinstance(args, SchoolWithoutInternetArguments)
            _, total, rows = repository.list_escolas_sem_internet(
                municipality["codigo_ibge"], args.limite, args.offset
            )
            return _source_result(
                _SQLITE_SOURCE,
                {
                    "municipio": municipality["municipio"],
                    "uf": municipality["uf"],
                    "criterio": "INEP: IN_INTERNET = 0",
                    "total_sem_internet": total,
                    "escolas": rows,
                },
                total_retornado=len(rows),
            ), "success"

        assert isinstance(args, EngineMunicipalityArguments)
        municipality = _engine_municipality(municipios, args)
        if municipality is None:
            return _not_found(
                _ENGINE_SOURCE,
                "Município não disponível no conjunto demonstrativo do motor.",
            ), "not_found"

        if name == "consultar_scores_municipio":
            scores = {
                field: municipality[field]
                for field in (
                    "id_municipio",
                    "nome",
                    "uf",
                    "score_M",
                    "score_I",
                    "score_C",
                    "score_A",
                    "score_total",
                    "quadrante",
                )
            }
            return _source_result(_ENGINE_SOURCE, scores), "success"

        alavancas = Alavancas().model_copy(
            update={"backhaul_comprometido": bool(municipality["acordo_migracao"])}
        )
        result = business_case(
            id_municipio=str(municipality["id_municipio"]),
            domicilios_urbanos=int(municipality["domicilios_urbanos"]),
            dist_backhaul_km=float(municipality.get("dist_backhaul_km") or 0.0),
            num_escolas=int(municipality.get("eace_escolas", 0)),
            params=FinancialParams(),
            alavancas=alavancas,
        )
        return _source_result(
            _ENGINE_SOURCE,
            result.model_dump(),
            aviso="Resultado demonstrativo; não representa recomendação real de investimento.",
        ), "success"


TOOL_STATUS = Literal["success", "not_found", "failed", "cached"]
