"""
Step 1 — Base de municípios via IBGE API.

Produz um DataFrame com:
  id_municipio  (str, 7 dígitos)
  nome          (str)
  uf            (str, 2 letras)
  lat           (float)
  lon           (float)
  area_km2      (float)

Fontes:
  - Lista de municípios:  GET /v1/localidades/municipios
  - Centroide (lat/lon):  GET /v2/malhas/{codmun}?resolucao=5&formato=application/json
  - Área km²:             GET /v3/agregados/1301/periodos/2022/variaveis/615?localidades=N6[all]
"""

from __future__ import annotations

import logging
import time

import pandas as pd

from etl.utils import RAW_DIR, get_json

logger = logging.getLogger(__name__)

IBGE_BASE = "https://servicodados.ibge.gov.br/api"
CACHE_MUNICIPIOS = RAW_DIR / "ibge_municipios.parquet"
CACHE_AREA = RAW_DIR / "ibge_area_km2.parquet"
CACHE_CENTROIDS = RAW_DIR / "ibge_centroids.parquet"


def _fetch_municipios() -> pd.DataFrame:
    """Baixa lista de todos os municípios com código, nome e UF."""
    if CACHE_MUNICIPIOS.exists():
        logger.info("Cache: ibge_municipios.parquet")
        return pd.read_parquet(CACHE_MUNICIPIOS)

    logger.info("Buscando lista de municípios na IBGE API…")
    data = get_json(f"{IBGE_BASE}/v1/localidades/municipios")
    rows = []
    for m in data:
        # Alguns municípios (ex: Brasília) têm microrregiao=null; fallback pela UF da região-imediata
        microrregiao = m.get("microrregiao")
        if microrregiao:
            uf = microrregiao["mesorregiao"]["UF"]["sigla"]
        else:
            regiao_imediata = m.get("regiao-imediata") or {}
            regiao_intermediaria = regiao_imediata.get("regiao-intermediaria") or {}
            uf_obj = regiao_intermediaria.get("UF") or {}
            uf = uf_obj.get("sigla", "")
        if not uf:
            logger.warning("UF não encontrada para município %s (%s)", m["id"], m["nome"])
            continue
        rows.append({
            "id_municipio": str(m["id"]).zfill(7),
            "nome": m["nome"],
            "uf": uf,
        })
    df = pd.DataFrame(rows)
    df.to_parquet(CACHE_MUNICIPIOS, index=False)
    logger.info("%d municípios carregados", len(df))
    return df


def _fetch_area() -> pd.DataFrame:
    """Baixa a área km² via SIDRA, agregado 4714 (Censo 2022).

    O agregado 1301 (2010) não tem os municípios criados depois de 2010, e sem área eles
    eram descartados na validação do schema.
    """
    if CACHE_AREA.exists():
        logger.info("Cache: ibge_area_km2.parquet")
        return pd.read_parquet(CACHE_AREA)

    logger.info("Buscando área km² na IBGE SIDRA…")
    data = get_json(
        f"{IBGE_BASE}/v3/agregados/4714/periodos/2022/variaveis/6318",
        params={"localidades": "N6[all]"},
    )
    rows = []
    for item in data:
        for res in item.get("resultados", []):
            for serie in res.get("series", []):
                loc = serie.get("localidade", {})
                valores = serie.get("serie", {})
                cod = str(loc.get("id", "")).zfill(7)
                # Pega o valor do período mais recente disponível
                valor = next(
                    (v for v in reversed(list(valores.values())) if v and v != "-"),
                    None,
                )
                if cod and valor:
                    try:
                        rows.append({"id_municipio": cod, "area_km2": float(valor.replace(",", "."))})
                    except (ValueError, AttributeError):
                        pass

    df = pd.DataFrame(rows)
    df.to_parquet(CACHE_AREA, index=False)
    logger.info("Área km² obtida para %d municípios", len(df))
    return df


# UFs do Brasil + DF
_UFS_CODIGOS = {
    "AC": 12, "AL": 27, "AM": 13, "AP": 16, "BA": 29, "CE": 23,
    "DF": 53, "ES": 32, "GO": 52, "MA": 21, "MG": 31, "MS": 50,
    "MT": 51, "PA": 15, "PB": 25, "PE": 26, "PI": 22, "PR": 41,
    "RJ": 33, "RN": 24, "RO": 11, "RR": 14, "RS": 43, "SC": 42,
    "SE": 28, "SP": 35, "TO": 17,
}


def _fetch_centroids(ids: list[str]) -> pd.DataFrame:
    """
    Busca centroides de todos os municípios via endpoint por UF (27 chamadas).
    Muito mais eficiente do que uma chamada por município.
    """
    if CACHE_CENTROIDS.exists():
        cached = pd.read_parquet(CACHE_CENTROIDS)
        if len(cached) >= len(ids) * 0.99:  # 99% = completo
            logger.info("Cache: ibge_centroids.parquet (%d registros)", len(cached))
            return cached
        logger.info("Cache incompleto (%d/%d) — rebuscando por UF", len(cached), len(ids))

    rows = []
    for uf, cod_uf in _UFS_CODIGOS.items():
        try:
            data = get_json(
                f"{IBGE_BASE}/v2/malhas/{cod_uf}",
                params={"resolucao": 5, "formato": "application/json", "intrarregiao": "municipio"},
            )
            objects = data.get("objects", {})
            for key in objects:
                geoms = objects[key].get("geometries", [])
                for geom in geoms:
                    props = geom.get("properties", {})
                    codarea = str(props.get("codarea", "")).zfill(7)
                    centroide = props.get("centroide")
                    if codarea and centroide and len(centroide) == 2:
                        lon, lat = centroide  # API retorna [lon, lat]
                        rows.append({"id_municipio": codarea, "lat": lat, "lon": lon})
            logger.info("UF %s: %d municípios", uf, len([r for r in rows if True]))
        except Exception as exc:
            logger.warning("Centroides falhou para UF %s: %s", uf, exc)
        time.sleep(0.2)

    df = pd.DataFrame(rows).drop_duplicates("id_municipio")
    df.to_parquet(CACHE_CENTROIDS, index=False)
    logger.info("Centroides obtidos para %d municípios", len(df))
    return df


def run() -> pd.DataFrame:
    """Executa o step 1 e retorna DataFrame com os 5.570 municípios."""
    df_mun = _fetch_municipios()
    df_area = _fetch_area()
    df_cent = _fetch_centroids(df_mun["id_municipio"].tolist())

    df = df_mun.merge(df_area, on="id_municipio", how="left")
    df = df.merge(df_cent, on="id_municipio", how="left")

    # Reporta municípios sem centroide ou área
    sem_coord = df["lat"].isna().sum()
    sem_area = df["area_km2"].isna().sum()
    if sem_coord:
        logger.warning("%d municípios sem centroide", sem_coord)
    if sem_area:
        logger.warning("%d municípios sem área km²", sem_area)

    logger.info("Step 1 concluído: %d municípios", len(df))
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df = run()
    print(df.head())
    print(f"\nTotal: {len(df)} municípios")
    print(f"Sem lat/lon: {df['lat'].isna().sum()}")
    print(f"Sem area_km2: {df['area_km2'].isna().sum()}")
