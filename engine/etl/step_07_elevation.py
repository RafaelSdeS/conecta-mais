"""
Step 7 — Elevação média municipal via SRTM 90m (OpenTopography ou biblioteca elevation).

Produz DataFrame com [id_municipio, elevacao_media_m].

Fonte primária: OpenTopography API (SRTM 90m) + rasterstats.
  Requer:
    1. Registro gratuito em https://portal.opentopography.org
    2. API key definida na variável de ambiente OPENTOPOGRAPHY_API_KEY
    3. pip install rasterio rasterstats

Fallback: 400m (elevação média nacional aproximada do Brasil).
  O campo elevação tem peso 20% dentro do score C (custo), que tem peso 25%
  no score total. Impacto de usar o valor médio: diferencial de ~5 pontos
  no score C para municípios extremos. Aceitável para o MVP.

Para ativar a coleta real:
  export OPENTOPOGRAPHY_API_KEY=sua_chave
  rm engine/data/raw/elevacao_municipios.parquet
  python -m etl.step_07_elevation
"""

from __future__ import annotations

import logging
import os

import pandas as pd

from etl.utils import RAW_DIR

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "elevacao_municipios.parquet"
ELEVACAO_FALLBACK = 400.0  # metros — média nacional aproximada


def _fetch_from_api(municipios: pd.DataFrame) -> pd.DataFrame | None:
    """
    Tenta calcular elevação via OpenTopography + rasterstats.
    Requer rasterio, rasterstats e API key.
    Retorna None se qualquer dependência estiver faltando.
    """
    api_key = os.getenv("OPENTOPOGRAPHY_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import rasterio  # noqa: F401
        import rasterstats  # noqa: F401
    except ImportError:
        logger.warning("rasterio ou rasterstats não instalado. Use: pip install rasterio rasterstats")
        return None

    # Importação real só se tudo estiver disponível
    from etl._elevation_api import fetch_all_elevations
    return fetch_all_elevations(municipios, api_key)


def run(municipios: pd.DataFrame | None = None) -> pd.DataFrame:
    """Retorna DataFrame com [id_municipio, elevacao_media_m]."""
    if CACHE.exists():
        logger.info("Cache: elevacao_municipios.parquet")
        return pd.read_parquet(CACHE)

    if municipios is None:
        mun_cache = RAW_DIR / "ibge_municipios.parquet"
        municipios = pd.read_parquet(mun_cache) if mun_cache.exists() else pd.DataFrame({"id_municipio": []})

    result = _fetch_from_api(municipios)

    if result is not None and len(result) > 100:
        logger.info("Elevação via OpenTopography: %d municípios", len(result))
        df = result
    else:
        logger.warning(
            "OpenTopography API indisponível (defina OPENTOPOGRAPHY_API_KEY e instale rasterio). "
            "Usando elevação média neutra de %.0fm para todos os municípios.",
            ELEVACAO_FALLBACK,
        )
        df = pd.DataFrame({
            "id_municipio": municipios["id_municipio"].tolist(),
            "elevacao_media_m": ELEVACAO_FALLBACK,
        })

    df.to_parquet(CACHE, index=False)
    logger.info("Elevação salva para %d municípios", len(df))
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df = run()
    print(df.describe())
