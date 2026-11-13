"""Trilha de auditoria mínima das chamadas de IA: uma linha JSON por chamada, sem texto do usuário."""

from __future__ import annotations

import json
import logging
import os
from collections import Counter, deque
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


def resumo(limite: int = 15, max_linhas: int = 5_000) -> dict:
    """Resumo do log de auditoria: totais, taxa de sucesso, latência, uso por endpoint e últimas chamadas."""
    path = Path(os.getenv("CONECTA_AUDIT_LOG") or DEFAULT_LOG)
    linhas: deque[dict] = deque(maxlen=max_linhas)
    try:
        with path.open(encoding="utf-8") as f:
            for texto in f:
                try:
                    linhas.append(json.loads(texto))
                except json.JSONDecodeError:
                    continue  # linha corrompida não derruba o painel
    except OSError:
        pass
    registros = list(linhas)
    if not registros:
        return {"total": 0, "ok": 0, "taxa_ok": None, "latencia_media_ms": None, "latencia_p95_ms": None,
                "por_endpoint": {}, "ferramentas": {}, "ultimas": [], "arquivo": path.name}
    latencias = sorted(r.get("latencia_ms", 0) for r in registros)
    ferramentas = Counter(f for r in registros for f in r.get("ferramentas", []))
    ok = sum(1 for r in registros if r.get("ok"))
    return {
        "total": len(registros),
        "ok": ok,
        "taxa_ok": round(ok / len(registros), 3),
        "latencia_media_ms": round(sum(latencias) / len(latencias)),
        "latencia_p95_ms": latencias[min(len(latencias) - 1, int(len(latencias) * 0.95))],
        "por_endpoint": dict(Counter(r.get("endpoint", "?") for r in registros)),
        "ferramentas": dict(ferramentas.most_common(8)),
        "ultimas": registros[-limite:][::-1],
        "arquivo": path.name,
    }
