"""
Step 3 — Backhaul de fibra por município via Base dos Dados (GCS público).

Produz um DataFrame com colunas [id_municipio, tem_backhaul_fibra].

Fonte: Base dos Dados — br_anatel_banda_larga_fixa/backhaul
  https://storage.googleapis.com/basedosdados-public/one-click-download/
  br_anatel_banda_larga_fixa/backhaul/backhaul.csv.gz

O campo tem_backhaul_fibra = True quando o município tem tecnologia contendo
"Fibra" (ex: "Fibra", "Fibra + SDH-NG", "Rádio + Fibra + SDH-NG").
"""

from __future__ import annotations

import logging

import pandas as pd

from etl.utils import RAW_DIR, download_file

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "anatel_backhaul.parquet"
URL = (
    "https://storage.googleapis.com/basedosdados-public"
    "/one-click-download/br_anatel_banda_larga_fixa/backhaul/backhaul.csv.gz"
)
RAW_GZ = RAW_DIR / "backhaul.csv.gz"


def run() -> pd.DataFrame:
    """Retorna DataFrame com colunas [id_municipio, tem_backhaul_fibra]."""
    if CACHE.exists():
        logger.info("Cache: anatel_backhaul.parquet")
        return pd.read_parquet(CACHE)

    download_file(URL, RAW_GZ)

    df_raw = pd.read_csv(RAW_GZ, compression="gzip", dtype={"id_municipio": str})
    logger.info("Backhaul carregado: %d linhas, %d municípios únicos", len(df_raw), df_raw["id_municipio"].nunique())

    # Normaliza código IBGE para 7 dígitos com zero-padding
    df_raw["id_municipio"] = df_raw["id_municipio"].str.zfill(7)

    # tem_backhaul_fibra = True se a tecnologia contém "Fibra"
    tem_fibra = (
        df_raw[df_raw["tecnologia"].str.contains("Fibra", case=False, na=False)]["id_municipio"]
        .unique()
    )
    logger.info("%d municípios com backhaul de fibra", len(tem_fibra))

    # Todos os municípios do dataset — marca True/False
    todos = df_raw["id_municipio"].unique()
    df = pd.DataFrame({
        "id_municipio": todos,
        "tem_backhaul_fibra": pd.array(
            [mid in set(tem_fibra) for mid in todos], dtype="boolean"
        ),
    })

    df.to_parquet(CACHE, index=False)
    logger.info(
        "Backhaul salvo: %d municípios (%d com fibra, %d sem)",
        len(df),
        df["tem_backhaul_fibra"].sum(),
        (~df["tem_backhaul_fibra"]).sum(),
    )
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df = run()
    print(df["tem_backhaul_fibra"].value_counts())
    print(df.head())
