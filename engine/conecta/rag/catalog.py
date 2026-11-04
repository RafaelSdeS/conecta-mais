"""Catálogo explícito de fontes locais permitidas para o índice RAG."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = ENGINE_DIR.parent
DEFAULT_INDEX_PATH = ENGINE_DIR / "data" / "rag_index.sqlite"


@dataclass(frozen=True)
class DocumentSource:
    path: str
    title: str
    document_type: str
    is_official: bool = False


OFFICIAL_REGULATORY_SOURCES: tuple[DocumentSource, ...] = ()


DOCUMENT_SOURCES = (
    DocumentSource(
        "docs/engine-technical-reference.md",
        "Referência técnica derivada do código do motor",
        "internal_derived",
    ),
    DocumentSource(
        "docs/PROPOSTA_DETALHADA.md",
        "Proposta detalhada do Conecta+",
        "internal_project",
    ),
    DocumentSource(
        "docs/arquitetura.md",
        "Arquitetura do Conecta+",
        "internal_project",
    ),
    DocumentSource(
        "docs/rafael-plan.md",
        "Plano de implementação do motor",
        "internal_project",
    ),
    DocumentSource(
        "docs/guia-de-uso.md",
        "Guia de uso do painel e do assistente",
        "internal_project",
    ),
    DocumentSource(
        "docs/api.md",
        "Referência da API do Conecta+",
        "internal_project",
    ),
    DocumentSource(
        "engine/conecta/scores/calculator.py",
        "Implementação dos scores",
        "implementation_code",
    ),
    DocumentSource(
        "engine/conecta/scores/models.py",
        "Modelos de pesos dos scores",
        "implementation_code",
    ),
    DocumentSource(
        "engine/conecta/financial/calculator.py",
        "Implementação dos cálculos financeiros",
        "implementation_code",
    ),
    DocumentSource(
        "engine/conecta/financial/models.py",
        "Modelos e premissas financeiras",
        "implementation_code",
    ),
    DocumentSource(
        "engine/conecta/optimizer/portfolio.py",
        "Implementação da otimização de portfólio",
        "implementation_code",
    ),
) + OFFICIAL_REGULATORY_SOURCES


def get_index_path() -> Path:
    configured = os.getenv("CONECTA_RAG_INDEX_PATH", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return DEFAULT_INDEX_PATH.resolve()
