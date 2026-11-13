"""Utilitários compartilhados pelo pipeline ETL do Conecta+."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import requests

logger = logging.getLogger(__name__)

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)


def normalize_ibge(code: Any) -> str:
    """
    Normaliza um código IBGE para 7 dígitos (string com zero-padding).

    O IPEA usa 6 dígitos; a Anatel às vezes também. A referência canônica
    do projeto é 7 dígitos conforme o IBGE Localidades API e o schema Pydantic.
    """
    s = str(int(float(str(code)))).strip()
    if len(s) == 6:
        # Adiciona o dígito verificador calculado por módulo 11
        return _add_ibge_check_digit(s)
    if len(s) == 7:
        return s
    raise ValueError(f"Código IBGE inválido: {code!r} (deve ter 6 ou 7 dígitos)")


def _add_ibge_check_digit(code6: str) -> str:
    """
    Calcula e adiciona o dígito verificador ao código IBGE de 6 dígitos.
    Algoritmo: pesos 1,2,1,2,1,2 → soma dos algarismos de cada produto → mod 10.
    """
    weights = [1, 2, 1, 2, 1, 2]
    total = 0
    for digit, weight in zip(code6, weights):
        product = int(digit) * weight
        total += product // 10 + product % 10
    check = (10 - (total % 10)) % 10
    return code6 + str(check)


def get_json(url: str, params: dict | None = None, retries: int = 3, backoff: float = 2.0) -> Any:
    """GET JSON com retry exponencial."""
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as exc:
            if attempt == retries - 1:
                raise
            wait = backoff ** attempt
            logger.warning("Tentativa %d falhou (%s); aguardando %.1fs", attempt + 1, exc, wait)
            time.sleep(wait)
    raise RuntimeError("Não deveria chegar aqui")


def download_file(url: str, dest: Path, chunk_size: int = 1 << 20) -> Path:
    """Baixa um arquivo para `dest`, mostrando progresso simples."""
    if dest.exists():
        logger.info("Cache encontrado: %s — pulando download", dest.name)
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Baixando %s → %s", url, dest)
    r = requests.get(url, stream=True, timeout=120)
    r.raise_for_status()
    downloaded = 0
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=chunk_size):
            f.write(chunk)
            downloaded += len(chunk)
    logger.info("Download concluído: %.1f MB", downloaded / 1e6)
    return dest
