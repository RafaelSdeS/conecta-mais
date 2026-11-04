"""Trilha de auditoria mínima das chamadas de IA: uma linha JSON por chamada, sem texto do usuário."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)
DEFAULT_LOG = Path(__file__).resolve().parents[2] / "data" / "auditoria_ia.jsonl"


def registrar(endpoint: str, ok: bool, latencia_ms: int, **extra) -> None:
    linha = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "endpoint": endpoint,
        "modelo": os.getenv("WATSONX_MODEL_ID", ""),
        "ok": ok,
        "latencia_ms": latencia_ms,
        **extra,
    }
    path = Path(os.getenv("CONECTA_AUDIT_LOG") or DEFAULT_LOG)
    try:
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(linha, ensure_ascii=False) + "\n")
    except OSError:
        logger.warning("auditoria_indisponivel")  # auditoria nunca derruba a resposta
