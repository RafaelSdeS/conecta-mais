"""
Step 2 — IVS (Índice de Vulnerabilidade Social) via IPEA OData.

Produz um DataFrame com colunas [id_municipio, ivs].

Fonte primária: IPEA OData API, série ADH_IVS (Atlas 2010, nível municipal).
Fallback: valor neutro 0.5 (mediana nacional) quando a API estiver indisponível.
  O IVS tem peso 15% no score I — não é bloqueante para o MVP.
  Quando o IPEA estiver disponível, basta reexecutar este step para atualizar.

Nota de conversão: o IPEA usa código IBGE de 6 dígitos (TERCODIGO).
Convertemos para 7 dígitos usando normalize_ibge() de utils.py.
"""

from __future__ import annotations

import logging

import pandas as pd

from etl.utils import RAW_DIR, get_json, normalize_ibge

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "ipea_ivs.parquet"
IPEA_BASE = "http://ipeadata.gov.br/api/odata4"
IVS_NEUTRAL = 0.5  # mediana nacional aproximada — usado como fallback


def _fetch_from_api() -> pd.DataFrame | None:
    """Tenta buscar IVS na API IPEA OData. Retorna None se indisponível."""
    import requests as _req
    try:
        rows: list[dict] = []
        url: str | None = f"{IPEA_BASE}/ValoresMunicipios"
        params: dict | None = {
            "$filter": "SERCODIGO eq 'ADH_IVS'",
            "$select": "TERCODIGO,VALVALOR",
            "$top": 10000,
        }
        while url:
            r = _req.get(url, params=params, timeout=15)
            r.raise_for_status()
            data = r.json()
            for item in data.get("value", []):
                code = str(item.get("TERCODIGO", "")).strip()
                valor = item.get("VALVALOR")
                if code and valor is not None:
                    try:
                        rows.append({"id_municipio_6": code.zfill(6), "ivs": float(valor)})
                    except (ValueError, TypeError):
                        pass
            url = data.get("@odata.nextLink")
            params = None

        if not rows:
            return None

        df_raw = pd.DataFrame(rows).drop_duplicates("id_municipio_6", keep="last")
        converted = []
        for _, row in df_raw.iterrows():
            try:
                converted.append({"id_municipio": normalize_ibge(row["id_municipio_6"]), "ivs": row["ivs"]})
            except ValueError:
                pass
        return pd.DataFrame(converted) if converted else None

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

    logger.info("Buscando IVS na IPEA OData API (timeout 20s)…")
    df = _fetch_from_api()

    if df is not None and len(df) > 100:
        logger.info("IVS obtido para %d municípios via API", len(df))
    else:
        logger.warning(
            "IPEA API indisponível ou sem dados. "
            "Usando IVS neutro (%.1f) para todos os municípios. "
            "Re-execute este step quando a API estiver disponível.",
            IVS_NEUTRAL,
        )
        if municipios is None:
            # Carrega base de municípios do cache do step 1
            mun_cache = RAW_DIR / "ibge_municipios.parquet"
            if mun_cache.exists():
                municipios = pd.read_parquet(mun_cache)
            else:
                raise RuntimeError("Execute o step 1 antes do step 2.")
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
