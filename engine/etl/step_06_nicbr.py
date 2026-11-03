"""
Step 6 — Velocidade medida nas escolas (NIC.br / Medidor Educação Conectada).

Produz DataFrame com [id_municipio, velocidade_medida_mbps].

Fonte primária: microdata TIC Educação (CGI.br / cetic.br).
  Não há API pública — os dados são publicados como relatório anual.
  Baixar manualmente de https://cetic.br/en/pesquisa/educacao/indicadores/
  e salvar em engine/data/raw/nicbr_velocidade.csv com colunas:
    id_municipio (7 dígitos), velocidade_mbps (float)

Fallback: 0.0 para todos os municípios (significado no schema: "sem medição").
  O score I interpreta 0 como déficit máximo — municípios sem medição recebem
  necessidade = max(alunos × 1Mbps, 50Mbps) como deficit total.
"""

from __future__ import annotations

import logging

import pandas as pd

from etl.utils import RAW_DIR

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "nicbr_velocidade.parquet"
MANUAL_CSV = RAW_DIR / "nicbr_velocidade.csv"


def run(municipios: pd.DataFrame | None = None) -> pd.DataFrame:
    """Retorna DataFrame com [id_municipio, velocidade_medida_mbps]."""
    if CACHE.exists():
        logger.info("Cache: nicbr_velocidade.parquet")
        return pd.read_parquet(CACHE)

    if MANUAL_CSV.exists():
        logger.info("Carregando velocidade NIC.br do CSV manual…")
        df = pd.read_csv(MANUAL_CSV, dtype={"id_municipio": str})
        df["id_municipio"] = df["id_municipio"].str.zfill(7)
        df["velocidade_medida_mbps"] = pd.to_numeric(df["velocidade_mbps"], errors="coerce").fillna(0.0)
        df = df[["id_municipio", "velocidade_medida_mbps"]]
        df.to_parquet(CACHE, index=False)
        logger.info("Velocidade NIC.br: %d municípios (CSV manual)", len(df))
        return df

    logger.warning(
        "Arquivo nicbr_velocidade.csv não encontrado em %s. "
        "Usando velocidade_medida_mbps = 0.0 (sem medição) para todos os municípios. "
        "Para dados reais: baixe o microdata TIC Educação em "
        "https://cetic.br/en/pesquisa/educacao/indicadores/ e salve como "
        "engine/data/raw/nicbr_velocidade.csv com colunas id_municipio, velocidade_mbps.",
        MANUAL_CSV,
    )
    if municipios is None:
        mun_cache = RAW_DIR / "ibge_municipios.parquet"
        municipios = pd.read_parquet(mun_cache) if mun_cache.exists() else pd.DataFrame({"id_municipio": []})

    df = pd.DataFrame({
        "id_municipio": municipios["id_municipio"].tolist(),
        "velocidade_medida_mbps": 0.0,
    })
    df.to_parquet(CACHE, index=False)
    logger.info("Velocidade NIC.br: %d municípios (fallback zero)", len(df))
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df = run()
    print(df.describe())
    print(f"\nTotal: {len(df)} municípios")
