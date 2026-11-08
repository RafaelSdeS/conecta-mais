"""Limite de chamadas de IA no protótipo público: protege os tokens do watsonx.

Só vale com CONECTA_IA_LIMITE_IP definida (dev e testes não são afetados):
  CONECTA_IA_LIMITE_IP      chamadas POST por IP em 10 min
  CONECTA_IA_LIMITE_GLOBAL  chamadas POST no total em 1 h (padrão 300)
"""

from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

JANELA_IP_S = 600
JANELA_GLOBAL_S = 3600

# Memória do processo: vale para uma instância só; com réplicas, trocar por um armazenamento compartilhado (Redis).
_por_ip: dict[str, deque[float]] = defaultdict(deque)
_global: deque[float] = deque()
_trava = threading.Lock()


def _cheia(fila: deque[float], maximo: int, janela_s: int, agora: float) -> bool:
    while fila and agora - fila[0] > janela_s:
        fila.popleft()
    return len(fila) >= maximo


def _ip(request: Request) -> str:
    # O último valor é o que o proxy de borda anexou; os anteriores o cliente pode forjar.
    encaminhado = request.headers.get("x-forwarded-for", "")
    if encaminhado:
        return encaminhado.split(",")[-1].strip()
    return request.client.host if request.client else "?"


def limitar_ia(request: Request) -> None:
    maximo_ip = int(os.getenv("CONECTA_IA_LIMITE_IP") or 0)
    if maximo_ip <= 0 or request.method != "POST":
        return
    maximo_global = int(os.getenv("CONECTA_IA_LIMITE_GLOBAL") or 300)
    agora = time.monotonic()
    ip = _ip(request)
    with _trava:
        if _cheia(_por_ip[ip], maximo_ip, JANELA_IP_S, agora):
            raise HTTPException(
                429,
                "Muitas perguntas em pouco tempo. Aguarde alguns minutos e tente de novo.",
                headers={"Retry-After": str(JANELA_IP_S)},
            )
        if _cheia(_global, maximo_global, JANELA_GLOBAL_S, agora):
            raise HTTPException(
                429,
                "O limite de uso da demonstração foi atingido. Tente de novo mais tarde.",
                headers={"Retry-After": str(JANELA_GLOBAL_S)},
            )
        _por_ip[ip].append(agora)
        _global.append(agora)
