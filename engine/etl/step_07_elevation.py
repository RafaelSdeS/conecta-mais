"""
Step 7 — Elevação municipal via SRTM 90m (OpenTopoData, API pública sem chave).

Produz DataFrame com [id_municipio, elevacao_media_m].

Fonte: https://api.opentopodata.org/v1/srtm90m — elevação SRTM 90m no centroide do
município (aproximação da média municipal). Limites públicos: 100 pontos por
requisição, 1 requisição/s, 1.000 requisições/dia (≈56 para os 5.571 municípios).

Fallback: 400m (elevação média nacional aproximada) para municípios sem leitura
ou quando a API estiver indisponível. O campo pesa 20% do score C.

Para refazer a coleta: rm engine/data/raw/elevacao_municipios.parquet
"""

from __future__ import annotations

import logging
import time

import pandas as pd

from etl.utils import RAW_DIR

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "elevacao_municipios.parquet"
ELEVACAO_FALLBACK = 400.0  # metros — média nacional aproximada
OPENTOPODATA_URL = "https://api.opentopodata.org/v1/srtm90m"


def _fetch_from_api(municipios: pd.DataFrame) -> pd.DataFrame | None:
    """Consulta o SRTM 90m no centroide de cada município. None se a API falhar."""
    import requests

    pts = municipios.dropna(subset=["lat", "lon"])
    out: dict[str, float] = {}
    for i in range(0, len(pts), 100):
        lote = pts.iloc[i : i + 100]
        locs = "|".join(f"{la:.5f},{lo:.5f}" for la, lo in zip(lote["lat"], lote["lon"]))
        for tentativa in range(3):
            try:
                r = requests.get(OPENTOPODATA_URL, params={"locations": locs}, timeout=30)
                r.raise_for_status()
                for mid, res in zip(lote["id_municipio"], r.json()["results"]):
                    if res.get("elevation") is not None:
                        out[mid] = max(float(res["elevation"]), 0.0)
                break
            except Exception as exc:
                logger.warning("OpenTopoData lote %d, tentativa %d: %s", i // 100, tentativa + 1, exc)
                time.sleep(3)
        else:
            return None
        time.sleep(1.1)  # limite público: 1 requisição/s
    return pd.DataFrame({"id_municipio": list(out), "elevacao_media_m": list(out.values())})


def run(municipios: pd.DataFrame | None = None) -> pd.DataFrame:
    """Retorna DataFrame com [id_municipio, elevacao_media_m]."""
    if CACHE.exists():
        logger.info("Cache: elevacao_municipios.parquet")
        return pd.read_parquet(CACHE)

    if municipios is None:
        mun_cache = RAW_DIR / "ibge_municipios.parquet"
        municipios = pd.read_parquet(mun_cache) if mun_cache.exists() else pd.DataFrame({"id_municipio": []})

    if "lat" not in municipios.columns:  # execução isolada do step: usa os centroides em cache
        municipios = municipios.merge(pd.read_parquet(RAW_DIR / "ibge_centroids.parquet"), on="id_municipio", how="left")

    result = _fetch_from_api(municipios)

    if result is not None and len(result) > 100:
        logger.info("Elevação via OpenTopoData: %d municípios", len(result))
        df = municipios[["id_municipio"]].merge(result, on="id_municipio", how="left")
        df["elevacao_media_m"] = df["elevacao_media_m"].fillna(ELEVACAO_FALLBACK)
    else:
        logger.warning(
            "OpenTopoData indisponível. Usando elevação neutra de %.0fm para todos os municípios.",
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
