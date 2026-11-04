"""
Step 2 — IVS (Índice de Vulnerabilidade Social) via IPEA OData.

Produz um DataFrame com colunas [id_municipio, ivs].

Fonte primária: IPEA OData API, série AVS_IVS (nível estadual; aplicada a cada município da UF).
Fallback: valor neutro 0.5 (mediana nacional) quando a API estiver indisponível.
  O IVS tem peso 15% no score I — não é bloqueante para o MVP.
  Quando o IPEA estiver disponível, basta reexecutar este step para atualizar.
"""

from __future__ import annotations

import logging

import pandas as pd

from etl.utils import RAW_DIR, get_json, normalize_ibge

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "ipea_ivs.parquet"
IPEA_BASE = "http://www.ipeadata.gov.br/api/odata4"
IVS_NEUTRAL = 0.5  # mediana nacional aproximada — usado como fallback


def _fetch_from_api(municipios: pd.DataFrame) -> pd.DataFrame | None:
    """
    IVS por UF (série AVS_IVS, ano mais recente) aplicado aos municípios da UF.

    A API do Ipeadata só publica IVS em nível estadual; o valor municipal exige o
    download do Atlas (ivs.ipea.gov.br). Por isso o resultado é aproximado.
    """
    import requests as _req
    try:
        r = _req.get(f"{IPEA_BASE}/ValoresSerie(SERCODIGO='AVS_IVS')", timeout=30)
        r.raise_for_status()
        rows = [x for x in r.json().get("value", []) if x.get("NIVNOME") == "Estados"]
        if not rows:
            return None
        ano = max(x["VALDATA"][:4] for x in rows)
        por_uf = {
            str(x["TERCODIGO"]).zfill(2): float(x["VALVALOR"])
            for x in rows
            if x["VALDATA"][:4] == ano and x.get("VALVALOR") is not None
        }
        ivs = municipios["id_municipio"].str[:2].map(por_uf)
        if ivs.isna().any():
            return None
        logger.info("IVS estadual de %s aplicado aos municípios da UF", ano)
        return pd.DataFrame({"id_municipio": municipios["id_municipio"], "ivs": ivs.clip(0, 1)})
    except Exception as exc:
        logger.warning("IPEA API indisponível: %s", exc)
        return None


def run(municipios: pd.DataFrame | None = None) -> pd.DataFrame:
    """
    Retorna DataFrame com colunas [id_municipio, ivs].

    Args:
        municipios: DataFrame do step 1 (necessário para o fallback com todos os ids).
    """
    if CACHE.exists():
        logger.info("Cache: ipea_ivs.parquet")
        return pd.read_parquet(CACHE)

    if municipios is None:
        mun_cache = RAW_DIR / "ibge_municipios.parquet"
        if not mun_cache.exists():
            raise RuntimeError("Execute o step 1 antes do step 2.")
        municipios = pd.read_parquet(mun_cache)

    logger.info("Buscando IVS na IPEA OData API (timeout 30s)…")
    df = _fetch_from_api(municipios)

    if df is None:
        logger.warning(
            "IPEA API indisponível ou sem dados. "
            "Usando IVS neutro (%.1f) para todos os municípios. "
            "Re-execute este step quando a API estiver disponível.",
            IVS_NEUTRAL,
        )
        df = pd.DataFrame({
            "id_municipio": municipios["id_municipio"].tolist(),
            "ivs": IVS_NEUTRAL,
        })

    df.to_parquet(CACHE, index=False)
    logger.info("IVS salvo para %d municípios", len(df))
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df = run()
    print(df.describe())
    print(f"\nTotal: {len(df)} municípios com IVS")
    print(df.head())
