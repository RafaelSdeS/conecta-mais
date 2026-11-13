"""Criação explícita e reproduzível do índice FTS5 local."""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from conecta.rag.catalog import (
    DOCUMENT_SOURCES,
    REPOSITORY_ROOT,
    DocumentSource,
    get_index_path,
)

CHUNK_SIZE_CHARS = 1_400
_MARKDOWN_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
_PYTHON_DECLARATION = re.compile(r"^(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)")


@dataclass(frozen=True)
class DocumentChunk:
    title: str
    content: str
    source_path: str
    section: str
    line_start: int
    line_end: int
    document_type: str
    is_official: bool


def _document_title(source: DocumentSource, text: str) -> str:
    if source.path.endswith(".md"):
        for line in text.splitlines():
            match = _MARKDOWN_HEADING.match(line)
            if match:
                return match.group(2).strip()
    return source.title


def _iter_chunks(
    source: DocumentSource,
    text: str,
    *,
    chunk_size_chars: int = CHUNK_SIZE_CHARS,
) -> list[DocumentChunk]:
    title = _document_title(source, text)
    lines = text.splitlines()
    headings: list[tuple[int, str]] = []
    section = title
    current: list[str] = []
    current_start = 1
    current_end = 0
    current_length = 0
    chunks: list[DocumentChunk] = []

    def flush() -> None:
        nonlocal current, current_length
        content = "\n".join(current).strip()
        if content:
            chunks.append(
                DocumentChunk(
                    title=title,
                    content=content,
                    source_path=source.path,
                    section=section,
                    line_start=current_start,
                    line_end=current_end,
                    document_type=source.document_type,
                    is_official=source.is_official,
                )
            )
        current = []
        current_length = 0

    for line_number, original_line in enumerate(lines, start=1):
        markdown_heading = _MARKDOWN_HEADING.match(original_line)
        python_declaration = _PYTHON_DECLARATION.match(original_line)
        if markdown_heading:
            flush()
            level = len(markdown_heading.group(1))
            headings = [item for item in headings if item[0] < level]
            headings.append((level, markdown_heading.group(2).strip()))
            section = " > ".join(item[1] for item in headings)
        elif source.path.endswith(".py") and python_declaration:
            flush()
            section = python_declaration.group(1)

        pieces = [
            original_line[index : index + chunk_size_chars]
            for index in range(0, max(1, len(original_line)), chunk_size_chars)
        ]
        for piece in pieces:
            extra_length = len(piece) + (1 if current else 0)
            if current and current_length + extra_length > chunk_size_chars:
                flush()
            if not current:
                current_start = line_number
            current.append(piece)
            current_end = line_number
            current_length += len(piece) + (1 if len(current) > 1 else 0)

    flush()
    return chunks


def build_index(
    index_path: str | Path | None = None,
    *,
    repository_root: str | Path = REPOSITORY_ROOT,
    sources: Iterable[DocumentSource] = DOCUMENT_SOURCES,
) -> tuple[int, int]:
    """Rebuild the complete index; never called as part of a chat request."""
    root = Path(repository_root).resolve()
    selected_sources = tuple(sources)
    source_texts: list[tuple[DocumentSource, str]] = []
    for source in selected_sources:
        source_path = (root / source.path).resolve()
        if not source_path.is_relative_to(root):
            raise ValueError("A fonte RAG precisa permanecer dentro do repositório.")
        if not source_path.is_file():
            raise FileNotFoundError(f"Fonte RAG ausente: {source.path}")
        source_texts.append(
            (source, source_path.read_text(encoding="utf-8"))
        )

    destination = Path(index_path).expanduser().resolve() if index_path else get_index_path()
    sqlite_path = os.getenv("CONECTA_SQLITE_PATH", "").strip()
    if sqlite_path and destination == Path(sqlite_path).expanduser().resolve():
        raise ValueError("O índice RAG não pode sobrescrever o SQLite integrado.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(destination)
    try:
        with connection:
            connection.execute(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks USING fts5(
                    title,
                    content,
                    source_path UNINDEXED,
                    section UNINDEXED,
                    line_start UNINDEXED,
                    line_end UNINDEXED,
                    document_type UNINDEXED,
                    is_official UNINDEXED,
                    tokenize = 'unicode61 remove_diacritics 2'
                )
                """
            )
            connection.execute("DELETE FROM rag_chunks")
            chunk_count = 0
            for source, text in source_texts:
                chunks = _iter_chunks(source, text)
                connection.executemany(
                    """
                    INSERT INTO rag_chunks (
                        title, content, source_path, section, line_start, line_end,
                        document_type, is_official
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            chunk.title,
                            chunk.content,
                            chunk.source_path,
                            chunk.section,
                            chunk.line_start,
                            chunk.line_end,
                            chunk.document_type,
                            int(chunk.is_official),
                        )
                        for chunk in chunks
                    ],
                )
                chunk_count += len(chunks)
    finally:
        connection.close()

    return len(source_texts), chunk_count


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reconstrói o índice local de documentação do Conecta+."
    )
    parser.add_argument(
        "--index",
        type=Path,
        help="Caminho alternativo para o SQLite FTS5.",
    )
    args = parser.parse_args()
    documents, chunks = build_index(args.index)
    index_path = args.index.expanduser().resolve() if args.index else get_index_path()
    print(
        f"Índice atualizado: {documents} documentos, {chunks} trechos "
        f"em {index_path}"
    )


if __name__ == "__main__":
    main()
