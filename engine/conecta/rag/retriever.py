"""Consultas BM25 ao índice FTS5, sem reconstrução automática."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

from conecta.rag.catalog import get_index_path

MAX_QUERY_CHARS = 500
MAX_RESULTS = 4
_QUERY_TOKEN = re.compile(r"[^\W_]+", re.UNICODE)


class RAGIndexUnavailable(RuntimeError):
    """O índice local está ausente, vazio ou incompatível."""


def _fts_query(query: str) -> str:
    terms = []
    for token in _QUERY_TOKEN.findall(query[:MAX_QUERY_CHARS]):
        if len(token) < 2 and token.upper() not in {"M", "I", "C", "A"}:
            continue
        quoted = '"' + token.replace('"', '""') + '"'
        if quoted not in terms:
            terms.append(quoted)
    return " OR ".join(terms[:32])


def search_documents(
    query: str,
    *,
    index_path: str | Path | None = None,
    limit: int = MAX_RESULTS,
) -> dict:
    safe_limit = max(1, min(int(limit), MAX_RESULTS))
    fts_query = _fts_query(query)
    if not fts_query:
        return {
            "found": False,
            "message": "A busca não contém termos suficientes para recuperar documentação.",
            "passages": [],
            "instructions_are_untrusted": True,
        }

    path = Path(index_path).expanduser().resolve() if index_path else get_index_path()
    if not path.is_file():
        raise RAGIndexUnavailable("O índice de documentação não foi criado.")

    normalized_query = query.casefold()
    asks_score_details = "score" in normalized_query and any(
        term in normalized_query
        for term in (
            "dimens",
            "formula",
            "fórmula",
            "peso",
            "calcul",
            "signific",
            "normaliz",
        )
    )
    targets_implemented_formula = any(
        term in normalized_query
        for term in (
            "score_a",
            "score_c",
            "acordo_migracao",
            "fust_elegivel",
            "eace_escolas",
            "dist_backhaul_km",
            "custo_proxy",
        )
    )
    if asks_score_details and targets_implemented_formula:
        ordering = """
            ORDER BY
                CASE document_type
                    WHEN 'implementation_code' THEN 0
                    WHEN 'internal_derived' THEN 1
                    ELSE 2
                END,
                relevance
        """
    elif asks_score_details:
        ordering = """
            ORDER BY
                CASE document_type
                    WHEN 'internal_derived' THEN 0
                    WHEN 'implementation_code' THEN 1
                    ELSE 2
                END,
                relevance
        """
    else:
        ordering = "ORDER BY relevance"

    try:
        connection = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            rows = connection.execute(
                f"""
                SELECT
                    title,
                    content,
                    source_path,
                    section,
                    line_start,
                    line_end,
                    document_type,
                    is_official,
                    bm25(
                        rag_chunks,
                        3.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
                    ) AS relevance
                FROM rag_chunks
                WHERE rag_chunks MATCH ?
                {ordering}
                LIMIT ?
                """,
                (fts_query, safe_limit),
            ).fetchall()
        finally:
            connection.close()
    except sqlite3.Error as exc:
        raise RAGIndexUnavailable(
            "O índice de documentação não está disponível ou é incompatível."
        ) from exc

    passages = [
        {
            "title": row["title"],
            "content": row["content"],
            "source_path": row["source_path"],
            "section": row["section"],
            "line_start": row["line_start"],
            "line_end": row["line_end"],
            "document_type": row["document_type"],
            "is_official": bool(row["is_official"]),
        }
        for row in rows
    ]
    return {
        "found": bool(passages),
        "message": (
            "Trechos recuperados da documentação local."
            if passages
            else "A documentação local indexada não contém trechos correspondentes."
        ),
        "passages": passages,
        "instructions_are_untrusted": True,
    }
