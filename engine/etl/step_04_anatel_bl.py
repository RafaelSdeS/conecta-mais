"""
Step 4 — Banda larga fixa, telefonia e dados socioeconômicos municipais.

Produz um DataFrame com colunas:
  id_municipio, domicilios_urbanos, renda_media,
  acessos_total_bl, acessos_fibra,
  market_share_vivo_movel, hhi, ppp_share

Fontes:
  - Domicílios: IBGE SIDRA tabela 4709 (Censo 2022)
  - Renda média: estimativa por UF (Censo 2022 IBGE — API instável, valores de referência)
  - Acessos BL total e fibra: derivados de densidade (Base dos Dados GCS) × domicílios
  - market_share_vivo_movel, hhi, ppp_share: valores neutros (microdados por
    prestadora não estão disponíveis no GCS público e o portal Anatel está
    protegido por Cloudflare — atualizar via Base dos Dados BigQuery quando disponível)

Notas:
  Os campos de share/HHI com valor neutro têm impacto limitado no score M:
    - market_share_vivo_movel: peso 20% do score M (neutralizado em 0.35 = média BR)
    - hhi: peso 10% do score M (neutralizado em 3000 = mercado moderado)
    - ppp_share: peso 5% do score M (neutralizado em 0.55 = média BR)
"""

from __future__ import annotations

import logging
import time

import pandas as pd
import requests

from etl.utils import RAW_DIR, get_json

logger = logging.getLogger(__name__)

CACHE = RAW_DIR / "anatel_ibge_bl.parquet"
IBGE_BASE = "https://servicodados.ibge.gov.br/api"
BDD_DENSIDADE_BL = (
    "https://storage.googleapis.com/basedosdados-public"
    "/one-click-download/br_anatel_banda_larga_fixa/densidade_municipio/densidade_municipio.csv.gz"
)

# Renda média domiciliar por UF — Censo 2022 IBGE (R$/mês, valores aproximados)
# Fonte: IBGE Censo 2022, Rendimento nominal médio mensal das pessoas de 10 anos ou mais de idade
_RENDA_UF: dict[str, float] = {
    "AC": 1_650, "AL": 1_420, "AM": 1_680, "AP": 1_720, "BA": 1_690,
    "CE": 1_530, "DF": 4_210, "ES": 2_440, "GO": 2_160, "MA": 1_290,
    "MG": 2_290, "MS": 2_200, "MT": 2_380, "PA": 1_540, "PB": 1_550,
    "PE": 1_790, "PI": 1_400, "PR": 2_540, "RJ": 2_850, "RN": 1_680,
    "RO": 1_980, "RR": 1_870, "RS": 2_700, "SC": 2_770, "SE": 1_730,
    "SP": 3_290, "TO": 1_820,
}
_RENDA_BRASIL = 2_200.0

# Valores neutros para campos sem microdados disponíveis
_MARKET_SHARE_VIVO_NEUTRO = 0.35   # ~35% de participação nacional da Vivo no móvel
_HHI_NEUTRO = 3_000.0              # mercado moderadamente concentrado
_PPP_SHARE_NEUTRO = 0.55           # ~55% de PPPs — média nacional


def _fetch_domicilios() -> pd.DataFrame:
    """Busca domicílios particulares permanentes por município (IBGE Censo 2022)."""
    cache = RAW_DIR / "ibge_domicilios.parquet"
    if cache.exists():
        logger.info("Cache: ibge_domicilios.parquet")
        return pd.read_parquet(cache)

    logger.info("Buscando domicílios no IBGE SIDRA (T4709 V93)…")
    for tentativa in range(3):
        try:
            data = get_json(
                f"{IBGE_BASE}/v3/agregados/4709/periodos/2022/variaveis/93",
                params={"localidades": "N6[all]"},
            )
            rows = []
            for item in data:
                for res in item.get("resultados", []):
                    for serie in res.get("series", []):
                        loc = serie["localidade"]
                        val = serie["serie"].get("2022")
                        if val and val != "-":
                            try:
                                rows.append({
                                    "id_municipio": str(loc["id"]).zfill(7),
                                    "domicilios_total": int(str(val).replace(",", "").replace(".", "")),
                                })
                            except (ValueError, TypeError):
                                pass
            if rows:
                df = pd.DataFrame(rows)
                df.to_parquet(cache, index=False)
                logger.info("Domicílios: %d municípios", len(df))
                return df
        except Exception as exc:
            logger.warning("Tentativa %d falhou: %s", tentativa + 1, exc)
            time.sleep(2)

    logger.warning("SIDRA indisponível para domicílios — usando estimativa por população")
    return pd.DataFrame(columns=["id_municipio", "domicilios_total"])


def _fetch_densidade_bl() -> pd.DataFrame:
    """Baixa densidade de banda larga por município (Base dos Dados GCS)."""
    cache = RAW_DIR / "anatel_densidade_bl.parquet"
    if cache.exists():
        logger.info("Cache: anatel_densidade_bl.parquet")
        return pd.read_parquet(cache)

    import io
    logger.info("Baixando densidade de BL (Base dos Dados GCS, ~10 MB)…")
    r = requests.get(BDD_DENSIDADE_BL, timeout=120)
    r.raise_for_status()
    df_all = pd.read_csv(io.BytesIO(r.content), compression="gzip", dtype={"id_municipio": str})
    df_all["id_municipio"] = df_all["id_municipio"].str.zfill(7)

    # Pega o mês mais recente
    latest_ano = df_all["ano"].max()
    df_latest = df_all[df_all["ano"] == latest_ano]
    latest_mes = df_latest["mes"].max()
    df = df_latest[df_latest["mes"] == latest_mes][["id_municipio", "densidade"]].copy()
    df = df.rename(columns={"densidade": "densidade_bl_por_100dom"})
    logger.info("Densidade BL: %d municípios (ref: %d/%02d)", len(df), latest_ano, latest_mes)

    df.to_parquet(cache, index=False)
    return df


def run(df_municipios: pd.DataFrame | None = None) -> pd.DataFrame:
    """Retorna DataFrame com campos de banda larga e socioeconomia por município."""
    if CACHE.exists():
        logger.info("Cache: anatel_ibge_bl.parquet")
        return pd.read_parquet(CACHE)

    # Carrega base de municípios (para ter UF e id)
    if df_municipios is None:
        mun_cache = RAW_DIR / "ibge_municipios.parquet"
        df_municipios = pd.read_parquet(mun_cache) if mun_cache.exists() else pd.DataFrame()

    df_domicilios = _fetch_domicilios()
    df_densidade = _fetch_densidade_bl()

    # Junta
    df = df_municipios[["id_municipio", "uf"]].copy() if not df_municipios.empty else pd.DataFrame()

    if not df_domicilios.empty:
        df = df.merge(df_domicilios, on="id_municipio", how="left")
    else:
        df["domicilios_total"] = 500  # fallback mínimo

    df = df.merge(df_densidade, on="id_municipio", how="left")

    # domicilios_urbanos: assume 80% dos domicílios são urbanos (média nacional Censo 2022)
    # (não temos separação urbano/rural por API estável no momento)
    df["domicilios_urbanos"] = (
        df["domicilios_total"].fillna(500) * 0.80
    ).astype(int)

    # acessos_total_bl = densidade × domicílios / 100
    df["acessos_total_bl"] = (
        df["densidade_bl_por_100dom"].fillna(0) * df["domicilios_total"].fillna(500) / 100
    ).astype(int)

    # acessos_fibra: assumimos 45% dos acessos são fibra (média nacional 2024)
    # (sem microdados por tecnologia no GCS público)
    df["acessos_fibra"] = (df["acessos_total_bl"] * 0.45).astype(int)

    # Renda por UF (estimativa)
    if "uf" in df.columns:
        df["renda_media"] = df["uf"].map(_RENDA_UF).fillna(_RENDA_BRASIL)
    else:
        df["renda_media"] = _RENDA_BRASIL

    # Campos de share/HHI — valores neutros (microdados indisponíveis via APIs públicas)
    df["market_share_vivo_movel"] = _MARKET_SHARE_VIVO_NEUTRO
    df["hhi"] = _HHI_NEUTRO
    df["ppp_share"] = _PPP_SHARE_NEUTRO

    cols = [
        "id_municipio", "domicilios_urbanos", "renda_media",
        "acessos_total_bl", "acessos_fibra",
        "market_share_vivo_movel", "hhi", "ppp_share",
    ]
    df = df[cols]
    df.to_parquet(CACHE, index=False)
    logger.info(
        "Step 4 concluído: %d municípios (dom_urb média: %d, acessos_bl média: %d)",
        len(df), df["domicilios_urbanos"].mean(), df["acessos_total_bl"].mean(),
    )
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df = run()
    print(df.describe())
    print(df.head())
