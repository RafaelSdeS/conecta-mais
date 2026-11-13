"""
Step 11 — Renda domiciliar per capita por município (Censo 2022, IBGE SIDRA tabela 10295).

Produz DataFrame com [id_municipio, renda_media] (R$/mês, rendimento nominal médio domiciliar
per capita). Fallback: o step 4 mantém a renda média por UF (campo aproximado).
"""

from __future__ import annotations

import logging

import pandas as pd

from etl.utils import RAW_DIR, get_json

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "ibge_renda_percapita.parquet"
URL = "https://servicodados.ibge.gov.br/api/v3/agregados/10295/periodos/2022/variaveis/13431"


def run() -> pd.DataFrame | None:
    if CACHE.exists():
        logger.info("Cache: ibge_renda_percapita.parquet")
        return pd.read_parquet(CACHE)
    try:
        data = get_json(URL, params={"localidades": "N6[all]"})
        linhas = []
        for item in data:
            for res in item.get("resultados", []):
                for serie in res.get("series", []):
                    valor = serie["serie"].get("2022")
                    try:
                        linhas.append({
                            "id_municipio": str(serie["localidade"]["id"]).zfill(7),
                            "renda_media": float(valor),
                        })
                    except (TypeError, ValueError):
                        pass  # "-" ou "X" (sigilo): município fica sem valor
        df = pd.DataFrame(linhas).drop_duplicates("id_municipio")
    except Exception as exc:
        logger.warning("SIDRA (renda) indisponível: %s", exc)
        return None
    if len(df) < 5000:
        logger.warning("SIDRA (renda) devolveu só %d municípios; ignorando.", len(df))
        return None
    df.to_parquet(CACHE, index=False)
    logger.info("Renda per capita: %d municípios", len(df))
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    d = run()
    print(None if d is None else d.describe())
