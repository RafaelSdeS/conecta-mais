"""
Step 9 — Semiárido brasileiro (delimitação IBGE/SUDENE, 2022).

Produz DataFrame com [id_municipio, semiarido] (bool).

Fonte: lista oficial de municípios do Semiárido publicada pelo IBGE
  https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/semiarido_brasileiro/Situacao_2022/

Fallback: semiarido=False para todos (campo registrado como neutro em data_quality).
"""

from __future__ import annotations

import io
import logging

import pandas as pd
import requests

from etl.utils import RAW_DIR

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "semiarido.parquet"
URL = (
    "https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/"
    "semiarido_brasileiro/Situacao_2022/lista_municipios_Semiarido_2022.xlsx"
)


def _fetch_ids() -> set[str] | None:
    try:
        r = requests.get(URL, timeout=60)
        r.raise_for_status()
        lista = pd.read_excel(io.BytesIO(r.content), dtype=str)
        return set(lista["CD_MUN"].str.strip().str.zfill(7))
    except Exception as exc:
        logger.warning("Lista do semiárido indisponível: %s", exc)
        return None


def run(municipios: pd.DataFrame | None = None) -> pd.DataFrame:
    """Retorna DataFrame com [id_municipio, semiarido]."""
    if CACHE.exists():
        logger.info("Cache: semiarido.parquet")
        return pd.read_parquet(CACHE)

    if municipios is None:
        municipios = pd.read_parquet(RAW_DIR / "ibge_municipios.parquet")

    ids = _fetch_ids()
    df = pd.DataFrame({"id_municipio": municipios["id_municipio"].tolist()})
    df["semiarido"] = df["id_municipio"].isin(ids) if ids else False
    if ids:
        logger.info("Semiárido: %d municípios", int(df["semiarido"].sum()))
        df.to_parquet(CACHE, index=False)  # só cacheia resultado real
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    print(run()["semiarido"].sum())
