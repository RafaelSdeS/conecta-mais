"""
Step 5 — Censo Escolar INEP 2024.

Popula duas estruturas:
  1. tabela `escolas`: uma linha por escola pública ativa com dados de conectividade.
     Lat/lon ficam NULL (microdados 2024 "defeso" não incluem coordenadas por sigilo).
     Um step opcional futuro pode enriquecê-los via geobr.
  2. agregados por município: matriculas_publicas, matriculas_rurais_pct,
     escolas_sem_internet_aprendizagem, alunos_maior_turno_est,
     total_escolas, escolas_sem_internet, escolas_sem_banda_larga

Fonte: microdados do Censo Escolar 2024 (INEP)
  https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2024.zip
  Arquivo interno: dados/microdados_ed_basica_2024.csv (~210 MB, latin-1, sep=;)

TP_DEPENDENCIA: 1=Federal, 2=Estadual, 3=Municipal, 4=Privada
TP_SITUACAO_FUNCIONAMENTO: 1=Em Atividade, 2=Paralisada, 3=Extinta no Ano, 4=Extinta
"""

from __future__ import annotations

import io
import logging
import zipfile

import pandas as pd
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from etl.utils import RAW_DIR

logger = logging.getLogger(__name__)

CACHE_ESCOLAS = RAW_DIR / "inep_escolas.parquet"
CACHE_MUNICIPIOS = RAW_DIR / "inep_municipios_agg.parquet"
CACHE_VISITA = RAW_DIR / "inep_escolas_visita.parquet"
INEP_URL = "https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2024.zip"
INEP_ZIP = RAW_DIR / "censo_escolar_2024.zip"
ESCOLA_CSV_PATH = "microdados_censo_escolar_2024_defeso/dados/microdados_ed_basica_2024.csv"

COLS_USADAS = [
    "CO_ENTIDADE", "CO_MUNICIPIO", "SG_UF", "NO_MUNICIPIO", "NO_ENTIDADE",
    "TP_DEPENDENCIA", "TP_SITUACAO_FUNCIONAMENTO",
    "IN_INTERNET", "IN_INTERNET_APRENDIZAGEM", "IN_BANDA_LARGA",
    "QT_MAT_BAS", "QT_MAT_ZR_RUR", "QT_MAT_BAS_D", "QT_MAT_BAS_N",
    # NU_LATITUDE e NU_LONGITUDE removidos dos microdados 2024 por sigilo (versão "defeso")
]


def _download_zip() -> bytes:
    if INEP_ZIP.exists():
        logger.info("Cache: censo_escolar_2024.zip")
        return INEP_ZIP.read_bytes()
    logger.info("Baixando Censo Escolar 2024 (~34 MB)…")
    r = requests.get(INEP_URL, timeout=180, verify=False)
    r.raise_for_status()
    INEP_ZIP.write_bytes(r.content)
    logger.info("Download concluído: %.1f MB", len(r.content) / 1e6)
    return r.content


def _load_raw(colunas: list[str] = COLS_USADAS) -> pd.DataFrame:
    """Lê o CSV de escolas do ZIP, filtra públicas ativas."""
    content = _download_zip()
    z = zipfile.ZipFile(io.BytesIO(content))

    logger.info("Lendo CSV de escolas (pode levar ~30s)…")
    df = pd.read_csv(
        z.open(ESCOLA_CSV_PATH),
        sep=";",
        encoding="latin-1",
        low_memory=False,
        usecols=colunas,
        dtype={c: str for c in ("CO_ENTIDADE", "CO_MUNICIPIO", "NU_ENDERECO", "CO_CEP", "NU_DDD", "NU_TELEFONE")},
    )
    logger.info("Total de registros brutos: %d", len(df))

    # Filtra apenas escolas públicas (1=Federal, 2=Estadual, 3=Municipal)
    df = df[df["TP_DEPENDENCIA"].isin([1, 2, 3])].copy()
    logger.info("Públicas: %d", len(df))

    # Filtra apenas ativas (TP_SITUACAO_FUNCIONAMENTO == 1)
    df = df[df["TP_SITUACAO_FUNCIONAMENTO"] == 1].copy()
    logger.info("Ativas: %d", len(df))

    return df


COLS_VISITA = [
    "CO_ENTIDADE", "CO_MUNICIPIO", "NO_ENTIDADE", "TP_DEPENDENCIA", "TP_SITUACAO_FUNCIONAMENTO",
    "TP_LOCALIZACAO", "IN_INTERNET_APRENDIZAGEM", "QT_MAT_BAS",
    "DS_ENDERECO", "NU_ENDERECO", "NO_BAIRRO", "CO_CEP", "NU_DDD", "NU_TELEFONE",
]
_REDE = {1: "Federal", 2: "Estadual", 3: "Municipal"}
_ZONA = {1: "Urbana", 2: "Rural"}


def _endereco(linha: pd.Series) -> str:
    rua = ", ".join(str(v).strip() for v in (linha["DS_ENDERECO"], linha["NU_ENDERECO"]) if pd.notna(v) and str(v).strip())
    cep = str(linha["CO_CEP"]) if pd.notna(linha["CO_CEP"]) else ""
    partes = [rua, str(linha["NO_BAIRRO"]).strip() if pd.notna(linha["NO_BAIRRO"]) else "",
              f"CEP {cep[:5]}-{cep[5:]}" if len(cep) == 8 else ""]
    return " - ".join(p for p in partes if p)


def _telefone(ddd: object, numero: object) -> str | None:
    if pd.isna(ddd) or pd.isna(numero) or not str(numero).strip():
        return None
    n = str(numero).strip()
    return f"({str(ddd).strip()}) {n[:-4]}-{n[-4:]}"


def escolas_visita() -> pd.DataFrame:
    """
    Escolas públicas ativas sem internet para aprendizagem (mesmo critério do veredito),
    com o que a visita de campo precisa: rede, zona, alunos, endereço e telefone.
    """
    if CACHE_VISITA.exists():
        logger.info("Cache: inep_escolas_visita.parquet")
        return pd.read_parquet(CACHE_VISITA)

    df = _load_raw(COLS_VISITA)
    df = df[df["IN_INTERNET_APRENDIZAGEM"] == 0]
    visita = pd.DataFrame({
        "codigo_inep": df["CO_ENTIDADE"],
        "id_municipio": df["CO_MUNICIPIO"].str.zfill(7),
        "escola": df["NO_ENTIDADE"],
        "rede": df["TP_DEPENDENCIA"].map(_REDE),
        "zona": df["TP_LOCALIZACAO"].map(_ZONA),
        "alunos": pd.to_numeric(df["QT_MAT_BAS"], errors="coerce").fillna(0).astype(int),
        "endereco": df.apply(_endereco, axis=1),
        "telefone": [_telefone(d, n) for d, n in zip(df["NU_DDD"], df["NU_TELEFONE"])],
    })
    visita.to_parquet(CACHE_VISITA, index=False)
    logger.info("Escolas para visita: %d", len(visita))
    return visita


def run() -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Retorna (df_escolas, df_municipios_agg).
    Usa cache se disponível.
    """
    if CACHE_ESCOLAS.exists() and CACHE_MUNICIPIOS.exists():
        logger.info("Cache: inep_escolas.parquet e inep_municipios_agg.parquet")
        return pd.read_parquet(CACHE_ESCOLAS), pd.read_parquet(CACHE_MUNICIPIOS)

    df = _load_raw()

    # --- Tabela escolas ---
    df_escolas = df[[
        "CO_ENTIDADE", "CO_MUNICIPIO", "SG_UF", "NO_MUNICIPIO", "NO_ENTIDADE",
        "IN_INTERNET", "IN_INTERNET_APRENDIZAGEM", "IN_BANDA_LARGA",
    ]].copy()
    # Lat/lon removidos dos microdados defeso — ficam NULL para enriquecimento posterior
    df_escolas["latitude"] = None
    df_escolas["longitude"] = None
    df_escolas["CO_MUNICIPIO"] = df_escolas["CO_MUNICIPIO"].str.zfill(7)
    df_escolas["IN_INTERNET"] = df_escolas["IN_INTERNET"].fillna(0).astype(int)
    df_escolas["IN_INTERNET_APRENDIZAGEM"] = df_escolas["IN_INTERNET_APRENDIZAGEM"].fillna(0).astype(int)
    df_escolas["IN_BANDA_LARGA"] = df_escolas["IN_BANDA_LARGA"].fillna(0).astype(int)

    logger.info("Tabela escolas: %d registros", len(df_escolas))

    # --- Agregações por município ---
    df["CO_MUNICIPIO"] = df["CO_MUNICIPIO"].str.zfill(7)
    df["QT_MAT_BAS"] = pd.to_numeric(df["QT_MAT_BAS"], errors="coerce").fillna(0)
    df["QT_MAT_ZR_RUR"] = pd.to_numeric(df["QT_MAT_ZR_RUR"], errors="coerce").fillna(0)
    df["QT_MAT_BAS_D"] = pd.to_numeric(df["QT_MAT_BAS_D"], errors="coerce").fillna(0)
    df["QT_MAT_BAS_N"] = pd.to_numeric(df["QT_MAT_BAS_N"], errors="coerce").fillna(0)

    # Alunos matriculados em escolas sem internet para aprendizagem (mesmo critério de
    # escolas_sem_internet_aprendizagem): base da métrica "estudantes a conectar".
    df["_mat_sem_internet"] = df["QT_MAT_BAS"].where(df["IN_INTERNET_APRENDIZAGEM"] == 0, 0)

    agg = df.groupby("CO_MUNICIPIO").agg(
        total_escolas=("CO_ENTIDADE", "count"),
        matriculas_publicas=("QT_MAT_BAS", "sum"),
        matriculas_rurais=("QT_MAT_ZR_RUR", "sum"),
        mat_diurno=("QT_MAT_BAS_D", "sum"),
        mat_noturno=("QT_MAT_BAS_N", "sum"),
        alunos_sem_internet=("_mat_sem_internet", "sum"),
        escolas_sem_internet=("IN_INTERNET", lambda x: (x == 0).sum()),
        escolas_sem_internet_aprendizagem=("IN_INTERNET_APRENDIZAGEM", lambda x: (x == 0).sum()),
        escolas_sem_banda_larga=("IN_BANDA_LARGA", lambda x: (x == 0).sum()),
    ).reset_index()

    agg["matriculas_publicas"] = agg["matriculas_publicas"].astype(int)
    agg["matriculas_rurais_pct"] = (
        agg["matriculas_rurais"] / agg["matriculas_publicas"].replace(0, 1)
    ).clip(0, 1)

    # alunos_maior_turno_est: estimativa = max(diurno, noturno)
    # (microdados públicos não têm matrícula por turno diretamente)
    agg["alunos_maior_turno_est"] = agg[["mat_diurno", "mat_noturno"]].max(axis=1).astype(int)

    df_mun_agg = agg.rename(columns={"CO_MUNICIPIO": "id_municipio"})[[
        "id_municipio", "total_escolas", "matriculas_publicas", "matriculas_rurais_pct",
        "alunos_maior_turno_est", "escolas_sem_internet",
        "escolas_sem_internet_aprendizagem", "escolas_sem_banda_larga",
        "alunos_sem_internet",
    ]]

    # Salva caches
    df_escolas.to_parquet(CACHE_ESCOLAS, index=False)
    df_mun_agg.to_parquet(CACHE_MUNICIPIOS, index=False)

    logger.info(
        "Step 5 concluído: %d escolas públicas ativas em %d municípios",
        len(df_escolas), len(df_mun_agg),
    )
    return df_escolas, df_mun_agg


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    df_esc, df_mun = run()
    print("\n--- Escolas ---")
    print(df_esc.head(3))
    print(f"Total: {len(df_esc):,}")
    print("\n--- Municípios (agregado) ---")
    print(df_mun.describe())
    print(df_mun.head(3))
