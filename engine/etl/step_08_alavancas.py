"""
Step 8 — Alavancas regulatórias: acordo de migração, FUST, EACE.

Produz DataFrame com [id_municipio, acordo_migracao, ano_backhaul, fust_elegivel, eace_escolas].

Fontes (arquivos manuais, versionados no repositório):
  engine/data/raw/acordo_migracao.csv
    Colunas: id_municipio (7 dígitos), ano_backhaul (int, ex: 2025-2034)
    Origem: lista oficial TCU/Anatel dos 121 municípios do acordo de migração da concessão Vivo.
    Ref: https://convergenciadigital.com.br/governo/tcu-aprova-acordo-de-r-45-bilhoes-...

  engine/data/raw/fust_municipios.csv
    Colunas: id_municipio (7 dígitos)
    Origem: editais FUST publicados pelo BNDES/MCom (municípios elegíveis).

  engine/data/raw/eace_municipios.csv
    Colunas: id_municipio (7 dígitos), eace_escolas (int)
    Origem: relatórios ENEC/MEC do programa EACE/Aprender Conectado.

Fallback: accord_migracao=False, fust_elegivel=False, eace_escolas=0.
  Os arquivos CSV acima precisam ser preenchidos manualmente com as listas
  oficiais. Enquanto não existirem, todos os municípios recebem score A zero
  por alavancas (o campo tem_backhaul_fibra do step 3 já está correto).
"""

from __future__ import annotations

import logging

import pandas as pd

from etl.utils import RAW_DIR

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "alavancas.parquet"
ACORDO_CSV = RAW_DIR / "acordo_migracao.csv"
FUST_CSV = RAW_DIR / "fust_municipios.csv"
EACE_CSV = RAW_DIR / "eace_municipios.csv"


def run(municipios: pd.DataFrame | None = None) -> pd.DataFrame:
    """Retorna DataFrame com [id_municipio, acordo_migracao, ano_backhaul, fust_elegivel, eace_escolas]."""
    if CACHE.exists():
        logger.info("Cache: alavancas.parquet")
        return pd.read_parquet(CACHE)

    if municipios is None:
        mun_cache = RAW_DIR / "ibge_municipios.parquet"
        municipios = pd.read_parquet(mun_cache) if mun_cache.exists() else pd.DataFrame({"id_municipio": []})

    df = pd.DataFrame({
        "id_municipio": municipios["id_municipio"].tolist(),
        "acordo_migracao": False,
        "ano_backhaul": pd.NA,
        "fust_elegivel": False,
        "eace_escolas": 0,
    })

    # Acordo de migração
    if ACORDO_CSV.exists():
        acordo = pd.read_csv(ACORDO_CSV, dtype={"id_municipio": str})
        acordo["id_municipio"] = acordo["id_municipio"].str.zfill(7)
        ids_acordo = set(acordo["id_municipio"])
        df["acordo_migracao"] = df["id_municipio"].isin(ids_acordo)
        if "ano_backhaul" in acordo.columns:
            mapa_ano = acordo.set_index("id_municipio")["ano_backhaul"].to_dict()
            df["ano_backhaul"] = df["id_municipio"].map(mapa_ano)
        logger.info("Acordo de migração: %d municípios", df["acordo_migracao"].sum())
    else:
        logger.warning(
            "acordo_migracao.csv não encontrado em %s. "
            "acordo_migracao=False para todos. "
            "Para dados reais: extraia os 121 municípios do acordo TCU/Anatel.",
            ACORDO_CSV,
        )

    # FUST
    if FUST_CSV.exists():
        fust = pd.read_csv(FUST_CSV, dtype={"id_municipio": str})
        fust["id_municipio"] = fust["id_municipio"].str.zfill(7)
        df["fust_elegivel"] = df["id_municipio"].isin(set(fust["id_municipio"]))
        logger.info("FUST elegível: %d municípios", df["fust_elegivel"].sum())
    else:
        logger.warning(
            "fust_municipios.csv não encontrado. fust_elegivel=False para todos. "
            "Para dados reais: baixe os editais FUST em https://www.bndes.gov.br."
        )

    # EACE / Aprender Conectado
    if EACE_CSV.exists():
        eace = pd.read_csv(EACE_CSV, dtype={"id_municipio": str})
        eace["id_municipio"] = eace["id_municipio"].str.zfill(7)
        mapa_eace = eace.set_index("id_municipio")["eace_escolas"].to_dict()
        df["eace_escolas"] = df["id_municipio"].map(mapa_eace).fillna(0).astype(int)
        logger.info("EACE: %d municípios com escolas no programa", (df["eace_escolas"] > 0).sum())
    else:
        logger.warning(
            "eace_municipios.csv não encontrado. eace_escolas=0 para todos. "
            "Para dados reais: baixe relatórios ENEC em https://www.gov.br/mec/pt-br/escolas-conectadas."
        )

    df.to_parquet(CACHE, index=False)
    logger.info(
        "Alavancas salvas: %d municípios (acordo=%d, fust=%d, eace>0=%d)",
        len(df),
        df["acordo_migracao"].sum(),
        df["fust_elegivel"].sum(),
        (df["eace_escolas"] > 0).sum(),
    )
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df = run()
    print(df.describe())
    print(f"\nTotal: {len(df)} municípios")
