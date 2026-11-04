"""Definições e execução controlada das ferramentas do agente."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass, field
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
from conecta.data.escopo import Regiao, filtrar_escopo
from conecta.optimizer.portfolio import add_financials, num_escolas_b2g, optimize_portfolio
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


@dataclass
class Cenario:
    """Premissas e alavancas ativas na tela, usadas pelas ferramentas de engine."""

    params: FinancialParams = field(default_factory=FinancialParams)
    alavancas: Alavancas = field(default_factory=Alavancas)

    def descricao(self) -> str:
        ativas = [
            nome
            for nome, ligada in (
                ("TCU", self.alavancas.backhaul_comprometido),
                ("FUST", self.alavancas.fust_reembolsavel),
                ("ENEC", self.alavancas.receita_escolar),
            )
            if ligada
        ]
        p = self.params
        return (
            f"alavancas: {', '.join(ativas) or 'nenhuma'}; ARPU R$ {p.arpu_mensal}, "
            f"adesão {p.adesao_pct:.0%}, margem EBITDA {p.margem_ebitda:.0%}, WACC {p.wacc:.2%}; "
            "CapEx e VPL em R$ milhões."
        )


class RankingArguments(ToolArguments):
    uf: str | None = Field(default=None, min_length=2, max_length=2, description="UF (ex.: BA); omita para o Brasil todo.")
    somente_semiarido: bool = Field(default=False, description="Restringe aos municípios do Semiárido.")
    regiao: Regiao | None = Field(default=None, description="Região do Brasil.")
    max_payback: float | None = Field(
        default=None, gt=0, le=50,
        description="Teto de payback em anos; só municípios com payback até esse valor atendem.",
    )
    criterio: Literal[
        "score_total", "score_M", "score_I", "score_C", "score_A",
        "payback", "vpl", "escolas_sem_internet_aprendizagem", "alunos_por_capex",
    ] = Field(
        default="score_total",
        description=(
            "Critério de ordenação. Retorno financeiro: payback (menor é melhor) ou vpl "
            "(maior é melhor). Impacto educacional: score_I. Estudantes atendidos por real "
            "investido: alunos_por_capex (alunos em escolas sem internet por R$ mi de CapEx)."
        ),
    )
    top_n: int = Field(default=5, ge=1, le=10)

    @field_validator("uf")
    @classmethod
    def normalize_uf(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None


class PortfolioArguments(ToolArguments):
    orcamento_mi: float = Field(gt=0, le=1_000_000, description="Orçamento de CapEx em R$ milhões.")
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    somente_semiarido: bool = False
    regiao: Regiao | None = None
    objetivo: Literal["retorno", "equilibrado", "alunos"] = Field(
        default="equilibrado",
        description="alunos = maximiza estudantes em escolas sem internet; retorno = maximiza VPL.",
    )
    peso_impacto: float = Field(default=0.5, ge=0, le=1, description="1 = só impacto social; 0 = só retorno (VPL).")
    max_payback: float = Field(default=10.0, gt=0, le=50, description="Payback máximo aceito, em anos.")

    @field_validator("uf")
    @classmethod
    def normalize_uf(cls, value: str | None) -> str | None:
        return value.strip().upper() if value is not None else None


class CompareArguments(ToolArguments):
    codigos_ibge: list[str] = Field(min_length=2, max_length=5, description="Códigos IBGE de 7 dígitos.")

    @field_validator("codigos_ibge")
    @classmethod
    def validate_codes(cls, value: list[str]) -> list[str]:
        if any(not re.fullmatch(r"\d{7}", code.strip()) for code in value):
            raise ValueError("Cada código IBGE deve ter 7 dígitos.")
        return [code.strip() for code in value]


class NoArguments(ToolArguments):
    pass


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
                "Consulta os scores M, I, C, A, total e quadrante de um município no motor. "
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
                "Calcula o business case (CapEx, payback, VPL) de um município no motor. "
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
    {
        "type": "function",
        "function": {
            "name": "ranking_municipios",
            "description": (
                "Ranking dos melhores municípios por critério (scores, payback, VPL ou "
                "escolas sem internet), opcionalmente dentro de uma UF. Use para perguntas "
                "como 'qual município recomendar', 'onde investir' ou 'maior retorno'."
            ),
            "parameters": RankingArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "otimizar_portfolio",
            "description": (
                "Seleciona o conjunto ótimo de municípios para um orçamento de CapEx "
                "(R$ milhões), opcionalmente numa UF. Use para 'como distribuir R$ X'."
            ),
            "parameters": PortfolioArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "comparar_municipios",
            "description": "Compara scores e business case de 2 a 5 municípios pelos códigos IBGE.",
            "parameters": CompareArguments.model_json_schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_qualidade_dados",
            "description": (
                "Informa quais campos do motor são reais, aproximados ou neutros "
                "(sem informação). Use ao qualificar a confiança de uma recomendação."
            ),
            "parameters": NoArguments.model_json_schema(),
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
_ENGINE_REAL_SOURCE = {
    "id": "engine",
    "tipo": "real",
    "descricao": (
        "Motor de scores e financeiro sobre a base real integrada; campos neutros "
        "ou aproximados estão listados em consultar_qualidade_dados."
    ),
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
    "ranking_municipios": RankingArguments,
    "otimizar_portfolio": PortfolioArguments,
    "comparar_municipios": CompareArguments,
    "consultar_qualidade_dados": NoArguments,
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


def _engine_source(municipios: pd.DataFrame) -> dict:
    return _ENGINE_REAL_SOURCE if municipios.attrs.get("fonte") == "real" else _ENGINE_SOURCE


_COLUNAS_RESUMO = [
    "id_municipio", "nome", "uf", "quadrante", "score_total", "score_M", "score_I",
    "score_C", "score_A", "dist_backhaul_km", "escolas_sem_internet_aprendizagem",
    "alunos_sem_internet",
]


def _resumo_municipios(df: pd.DataFrame) -> list[dict]:
    """Linhas enxutas (scores + business case) para caber no limite de contexto."""
    out = df[[c for c in _COLUNAS_RESUMO if c in df.columns]].copy()
    out["capex_mi"] = df["_capex"].round(2)
    out["payback_anos"] = df["_payback"].replace(float("inf"), float("nan")).round(2)
    out["vpl_mi"] = df["_npv"].round(2)
    if "alunos_sem_internet" in df.columns:
        out["alunos_por_mi_capex"] = (df["alunos_sem_internet"] / df["_capex"]).round(0)
    for col in ("score_total", "score_M", "score_I", "score_C", "score_A", "dist_backhaul_km"):
        if col in out:
            out[col] = out[col].round(1)
    return _json_safe(out.to_dict(orient="records"))


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
        cenario: Cenario | None = None,
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
            result, status = self._execute(name, args, municipios, cenario or Cenario())
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
        cenario: Cenario,
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

        engine_src = _engine_source(municipios)

        if name == "consultar_qualidade_dados":
            return _source_result(
                engine_src, {"campos": municipios.attrs.get("qualidade", [])}
            ), "success"

        if name == "ranking_municipios":
            assert isinstance(args, RankingArguments)
            df = filtrar_escopo(municipios, args.uf, args.somente_semiarido, args.regiao)
            if df.empty:
                return _not_found(engine_src, "Nenhum município encontrado no escopo pedido."), "not_found"
            df = add_financials(df, cenario.params, cenario.alavancas)
            df["_alunos_por_mi"] = df.get("alunos_sem_internet", 0) / df["_capex"]
            avisos: list[str] = []
            pool = df
            if args.max_payback is not None:
                atende = df[df["_payback"] <= args.max_payback]
                melhor = float(df["_payback"].min())
                if atende.empty:
                    avisos.append(
                        f"Nenhum município atende payback ≤ {args.max_payback} anos; o menor "
                        f"payback encontrado é {melhor:.2f}. A lista abaixo NÃO atende à restrição "
                        "(ranking sem o teto)."
                    )
                else:
                    pool = atende
            col, asc = {
                "payback": ("_payback", True),
                "vpl": ("_npv", False),
                "alunos_por_capex": ("_alunos_por_mi", False),
            }.get(args.criterio, (args.criterio, False))
            # Desempate: payback empata muito (CapEx e receita escalam juntos); VPL desempata.
            col2, asc2 = {"payback": ("_npv", False), "vpl": ("_payback", True)}.get(
                args.criterio, ("score_total", False)
            )
            ordenado = pool.assign(
                _k=pool[col].replace(float("inf"), float("nan")),
                _k2=pool[col2].replace(float("inf"), float("nan")),
            ).sort_values(["_k", "_k2"], ascending=[asc, asc2], na_position="last")
            return _source_result(
                engine_src,
                {
                    "criterio": args.criterio,
                    "escopo": {
                        "uf": args.uf, "semiarido": args.somente_semiarido, "regiao": args.regiao,
                    },
                    "ordem": "crescente (menor é melhor)" if asc else "decrescente",
                    "total_no_escopo": len(df),
                    "elegiveis_payback": (
                        None if args.max_payback is None else int((df["_payback"] <= args.max_payback).sum())
                    ),
                    "menor_payback_no_escopo": round(float(df["_payback"].min()), 2),
                    "avisos": avisos,
                    "municipios": _resumo_municipios(ordenado.head(args.top_n)),
                    "premissas": cenario.descricao(),
                },
            ), "success"

        if name == "otimizar_portfolio":
            assert isinstance(args, PortfolioArguments)
            df = filtrar_escopo(municipios, args.uf, args.somente_semiarido, args.regiao)
            result = optimize_portfolio(
                df, cenario.params, cenario.alavancas,
                budget=args.orcamento_mi, lambda_=args.peso_impacto, max_payback=args.max_payback,
                objetivo_modo=args.objetivo,
            )
            sel = result.municipios
            if not sel.empty:
                sel = sel.sort_values("score_total", ascending=False)
            return _source_result(
                engine_src,
                {
                    "escopo": {
                        "uf": args.uf, "semiarido": args.somente_semiarido, "regiao": args.regiao,
                    },
                    "status": result.status,
                    "candidatos": result.n_candidatos,
                    "selecionados": result.n_selecionados,
                    "capex_total_mi": result.capex_total,
                    "payback_medio_anos": result.payback_medio,
                    "alunos_atendidos": int(sel["alunos_sem_internet"].sum())
                    if "alunos_sem_internet" in sel and not sel.empty else 0,
                    "vpl_total_mi": round(float(sel["_npv"].sum()), 2) if not sel.empty else 0.0,
                    "municipios_top15": _resumo_municipios(sel.head(15)) if not sel.empty else [],
                    "premissas": (
                        f"objetivo={args.objetivo}; peso_impacto={args.peso_impacto}; "
                        f"max_payback={args.max_payback} anos; {cenario.descricao()}"
                    ),
                },
            ), "success"

        if name == "comparar_municipios":
            assert isinstance(args, CompareArguments)
            ids = municipios["id_municipio"].astype(str).str.strip()
            df = municipios[ids.isin(args.codigos_ibge)]
            ausentes = sorted(set(args.codigos_ibge) - set(ids[ids.isin(args.codigos_ibge)]))
            if df.empty:
                return _not_found(engine_src, "Nenhum dos municípios está disponível no motor."), "not_found"
            df = add_financials(df, cenario.params, cenario.alavancas)
            return _source_result(
                engine_src,
                {
                    "municipios": _resumo_municipios(df),
                    "ausentes": ausentes,
                    "premissas": cenario.descricao(),
                },
            ), "success"

        assert isinstance(args, EngineMunicipalityArguments)
        municipality = _engine_municipality(municipios, args)
        if municipality is None:
            return _not_found(
                engine_src,
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
            return _source_result(engine_src, scores), "success"

        alavancas = cenario.alavancas.model_copy(
            update={
                "backhaul_comprometido": cenario.alavancas.backhaul_comprometido
                and bool(municipality["acordo_migracao"])
            }
        )
        result = business_case(
            id_municipio=str(municipality["id_municipio"]),
            domicilios_urbanos=int(municipality["domicilios_urbanos"]),
            dist_backhaul_km=float(municipality.get("dist_backhaul_km") or 0.0),
            num_escolas=num_escolas_b2g(municipality),
            params=cenario.params,
            alavancas=alavancas,
        )
        return _source_result(
            engine_src,
            result.model_dump(),
            aviso=(
                "Resultado demonstrativo; não representa recomendação real de investimento."
                if engine_src is _ENGINE_SOURCE
                else "Estimativa com premissas padrão (FinancialParams); não substitui estudo de viabilidade."
            ),
        ), "success"


TOOL_STATUS = Literal["success", "not_found", "failed", "cached"]
