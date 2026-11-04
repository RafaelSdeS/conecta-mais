"""
Step 12 — Unidades Básicas de Saúde (UBS) por município (CNES, API de dados abertos do SUS).

Fonte: https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_tipo_unidade=2
  tipo 2 = Centro de Saúde / Unidade Básica; filtramos só as habilitadas (sem motivo de desabilitação).
A API pagina de 20 em 20; buscamos as páginas em paralelo.

Produz:
  - ubs.parquet: [codigo_cnes, nome, id_municipio, lat, lon] (uma linha por UBS)
  - contagem por município via ubs.groupby("id_municipio").size()
Sem a API, devolve None e o campo `ubs` fica 0 (neutro em data_quality).
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests

from etl.utils import RAW_DIR, normalize_ibge

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "ubs.parquet"
URL = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos"
_PAGINA = 20
_LOTE = 400  # páginas por rodada; a rodada para quando uma página vem vazia


def _pagina(offset: int) -> list[dict]:
    for tentativa in range(4):
        try:
            r = requests.get(URL, params={"codigo_tipo_unidade": 2, "limit": _PAGINA, "offset": offset}, timeout=60)
            r.raise_for_status()
            return r.json().get("estabelecimentos", [])
        except Exception as exc:
            if tentativa == 3:
                raise
            logger.debug("CNES offset %d, tentativa %d: %s", offset, tentativa + 1, exc)
    return []


def _baixa() -> list[dict]:
    todos: list[dict] = []
    offset = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        while True:
            paginas = list(pool.map(_pagina, range(offset, offset + _LOTE * _PAGINA, _PAGINA)))
            for p in paginas:
                todos.extend(p)
            logger.info("CNES: %d estabelecimentos", len(todos))
            if any(len(p) < _PAGINA for p in paginas):
                return todos
            offset += _LOTE * _PAGINA


def run() -> pd.DataFrame | None:
    if CACHE.exists():
        logger.info("Cache: ubs.parquet")
        return pd.read_parquet(CACHE)
    try:
        bruto = _baixa()
    except Exception as exc:
        logger.warning("API do CNES indisponível: %s", exc)
        return None
    linhas = []
    for e in bruto:
        if e.get("codigo_motivo_desabilitacao_estabelecimento") not in (None, "", 0):
            continue  # desabilitada
        try:
            idm = normalize_ibge(str(e["codigo_municipio"]).zfill(6))
        except (ValueError, KeyError):
            continue
        linhas.append({
            "codigo_cnes": str(e["codigo_cnes"]),
            "nome": (e.get("nome_fantasia") or e.get("nome_razao_social") or "").strip(),
            "id_municipio": idm,
            "lat": e.get("latitude_estabelecimento_decimo_grau"),
            "lon": e.get("longitude_estabelecimento_decimo_grau"),
        })
    df = pd.DataFrame(linhas).drop_duplicates("codigo_cnes")
    if len(df) < 20_000:
        logger.warning("CNES devolveu só %d UBS; ignorando (resultado incompleto).", len(df))
        return None
    df.to_parquet(CACHE, index=False)
    logger.info("UBS: %d em %d municípios", len(df), df["id_municipio"].nunique())
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    d = run()
    if d is not None:
        print(d.groupby("id_municipio").size().describe())
