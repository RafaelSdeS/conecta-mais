"""
Orquestrador principal do ETL Conecta+.

Executa todos os steps em sequência, junta os dados, valida contra o schema
Pydantic (Municipio) e grava o SQLite final com as tabelas:
  - municipios (5.570 linhas)
  - escolas   (137.847 linhas)
  - validacao_localizacao (vazia — preenchida por step futuro de geocodificação)
  - municipios_engine (todos os campos do schema Municipio, usados pelo motor)
  - backhaul (centroides dos municípios com backhaul de fibra)
  - data_quality (por campo: real, aproximado ou neutro)
  - bl_2021 (banda larga fixa de dezembro de 2021 por município, base do backtest)
  - provedores (provedores de banda larga fixa por município, base do "construir × comprar")
  - ubs (Unidades Básicas de Saúde do CNES, uma linha por UBS)

Uso:
  python -m etl.run_etl [--output engine/data/conecta_mais.db]

O arquivo de saída é definido por:
  1. argumento --output
  2. variável de ambiente CONECTA_SQLITE_PATH
  3. padrão: engine/data/conecta_mais.db
"""

from __future__ import annotations

import argparse
import logging
import os
import sqlite3
from pathlib import Path

import pandas as pd
from pydantic import ValidationError

from conecta.rag.indexer import build_index

logger = logging.getLogger(__name__)

DEFAULT_DB = Path(__file__).parent.parent / "data" / "conecta_mais.db"


def _run_all_steps() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Executa steps 1–8 e retorna (df_municipios, df_escolas, df_mun_agg)."""
    from etl.step_01_municipios import run as step1
    from etl.step_02_ivs import run as step2
    from etl.step_03_backhaul import run as step3
    from etl.step_04_anatel_bl import run as step4
    from etl.step_05_inep import run as step5
    from etl.step_06_nicbr import run as step6
    from etl.step_07_elevation import run as step7
    from etl.step_08_alavancas import run as step8
    from etl.step_09_semiarido import run as step9
    from etl.step_10_anatel_acessos import run as step10
    from etl.step_11_renda import run as step11
    from etl.step_12_ubs import run as step12

    logger.info("=== Step 1: municípios base ===")
    df_base = step1()

    logger.info("=== Step 2: IVS ===")
    df_ivs = step2(df_base)

    logger.info("=== Step 3: backhaul ===")
    df_backhaul = step3()

    logger.info("=== Step 4: banda larga e socioeconomia ===")
    df_bl = step4(df_base)

    logger.info("=== Step 5: Censo Escolar ===")
    df_escolas, df_inep_mun = step5()

    logger.info("=== Step 6: velocidade NIC.br ===")
    df_vel = step6(df_base)

    logger.info("=== Step 7: elevação ===")
    df_elev = step7(df_base)

    logger.info("=== Step 8: alavancas ===")
    df_alav = step8(df_base)

    logger.info("=== Step 9: semiárido ===")
    df_semi = step9(df_base)

    logger.info("=== Step 10: acessos reais da Anatel ===")
    try:
        df_anatel, df_bl_2021, df_prov = step10(df_base)
    except Exception as exc:  # sem a Anatel, mantém as estimativas do step 4 (campos neutros)
        logger.warning("Anatel indisponível (%s): mantendo as estimativas do step 4.", exc)
        df_anatel, df_bl_2021, df_prov = None, None, None

    logger.info("=== Step 11: renda municipal (IBGE) ===")
    df_renda = step11()

    logger.info("=== Step 12: UBS (CNES) ===")
    df_ubs = step12()

    # --- Junta tudo na base de municípios ---
    logger.info("=== Juntando todos os dados ===")
    df = df_base.copy()

    for other, cols in [
        (df_ivs, ["ivs"]),
        (df_backhaul, ["tem_backhaul_fibra"]),
        (df_bl, ["domicilios_urbanos", "renda_media"]
         + ([] if df_anatel is not None
            else ["acessos_total_bl", "acessos_fibra", "market_share_vivo_movel", "hhi", "ppp_share"])),
        (df_inep_mun, ["total_escolas", "matriculas_publicas", "matriculas_rurais_pct",
                       "alunos_maior_turno_est", "escolas_sem_internet",
                       "escolas_sem_internet_aprendizagem", "escolas_sem_banda_larga",
                       "alunos_sem_internet"]),
        (df_vel, ["velocidade_medida_mbps"]),
        (df_elev, ["elevacao_media_m"]),
        (df_alav, ["acordo_migracao", "ano_backhaul", "fust_elegivel", "eace_escolas"]),
        (df_semi, ["semiarido"]),
    ]:
        df = df.merge(other[["id_municipio"] + cols], on="id_municipio", how="left")

    # --- Preenche campos obrigatórios ausentes com defaults ---
    defaults = {
        "ivs": 0.5,
        "tem_backhaul_fibra": False,
        "domicilios_urbanos": 500,
        "renda_media": 2200.0,
        "acessos_total_bl": 0,
        "acessos_fibra": 0,
        "market_share_vivo_movel": 0.35,
        "hhi": 3000.0,
        "ppp_share": 0.55,
        "total_escolas": 0,
        "matriculas_publicas": 0,
        "matriculas_rurais_pct": 0.0,
        "alunos_maior_turno_est": 0,
        "escolas_sem_internet": 0,
        "escolas_sem_internet_aprendizagem": 0,
        "escolas_sem_banda_larga": 0,
        "alunos_sem_internet": 0,
        "semiarido": False,
        "velocidade_medida_mbps": 0.0,
        "elevacao_media_m": 400.0,
        "acordo_migracao": False,
        "fust_elegivel": False,
        "eace_escolas": 0,
    }
    if df_anatel is not None:
        df = df.merge(df_anatel, on="id_municipio", how="left")
        df["acessos_total_bl"] = df["acessos_total_bl"].fillna(0)  # sem registro na Anatel = sem acessos
        df["acessos_fibra"] = df["acessos_fibra"].fillna(0)
        for col in ("hhi", "ppp_share", "market_share_vivo_movel"):  # sem mercado: mediana nacional
            df[col] = df[col].fillna(df[col].median())

    if df_renda is not None:  # renda municipal real; municípios sem dado (sigilo) ficam com a média da UF
        df = df.merge(df_renda.rename(columns={"renda_media": "_renda_mun"}), on="id_municipio", how="left")
        df["renda_media"] = df["_renda_mun"].fillna(df["renda_media"])
        df = df.drop(columns="_renda_mun")
    df["ubs"] = (
        df["id_municipio"].map(df_ubs.groupby("id_municipio").size()).fillna(0).astype(int)
        if df_ubs is not None else 0
    )

    for col, default in defaults.items():
        if col in df.columns:
            df[col] = df[col].fillna(default)
        else:
            df[col] = default

    # Tipos finais
    df["domicilios_urbanos"] = df["domicilios_urbanos"].astype(int)
    df["acessos_total_bl"] = df["acessos_total_bl"].astype(int)
    df["acessos_fibra"] = df["acessos_fibra"].astype(int)
    df["matriculas_publicas"] = df["matriculas_publicas"].astype(int)
    df["alunos_maior_turno_est"] = df["alunos_maior_turno_est"].astype(int)
    df["escolas_sem_internet"] = df["escolas_sem_internet"].astype(int)
    df["escolas_sem_internet_aprendizagem"] = df["escolas_sem_internet_aprendizagem"].astype(int)
    df["escolas_sem_banda_larga"] = df["escolas_sem_banda_larga"].astype(int)
    df["eace_escolas"] = df["eace_escolas"].astype(int)
    df["alunos_sem_internet"] = df["alunos_sem_internet"].astype(int)
    df["semiarido"] = df["semiarido"].astype(bool)
    df["total_escolas"] = df["total_escolas"].astype(int)
    df["tem_backhaul_fibra"] = df["tem_backhaul_fibra"].astype(bool)
    df["acordo_migracao"] = df["acordo_migracao"].astype(bool)
    df["fust_elegivel"] = df["fust_elegivel"].astype(bool)

    logger.info("DataFrame final: %d municípios, %d colunas", len(df), len(df.columns))
    extras = {"bl_2021": df_bl_2021, "provedores": df_prov, "ubs": df_ubs}
    return df, df_escolas, df_inep_mun, extras


def _validate_schema(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Valida cada linha contra o schema Pydantic Municipio. Retorna linhas válidas e erros."""
    from conecta.data.schema import Municipio

    # Renomeia colunas para corresponder ao schema
    rename_map = {
        "nome": "nome",
        "id_municipio": "id_municipio",
    }
    df_valid = df.rename(columns=rename_map)

    # Mapeamento nome→nome_campo: area_km2 já está; adiciona dist_backhaul_km como None
    df_valid["dist_backhaul_km"] = None

    valid_rows = []
    errors = []
    records = df_valid.astype(object).where(df_valid.notna(), other=None).to_dict(orient="records")

    for i, row in enumerate(records):
        try:
            m = Municipio.model_validate(row)
            valid_rows.append(m.model_dump())
        except ValidationError as exc:
            mun_id = row.get("id_municipio", f"linha_{i}")
            errors.append(f"{mun_id}: {exc.errors()[0]['msg']} ({exc.errors()[0]['loc']})")

    if errors:
        logger.warning("%d municípios falharam na validação (primeiros 10):", len(errors))
        for e in errors[:10]:
            logger.warning("  %s", e)

    logger.info("Validação: %d válidos, %d inválidos", len(valid_rows), len(errors))
    return pd.DataFrame(valid_rows), errors


# Campos do motor que não vêm de fonte municipal exata (ver docstrings dos steps).
_APROXIMADOS = {"ivs", "elevacao_media_m"}  # por UF ou no centroide, não média municipal
_CAMPOS_QUALIDADE = [
    "domicilios_urbanos", "renda_media", "acessos_fibra", "acessos_total_bl",
    "market_share_vivo_movel", "hhi", "ppp_share", "area_km2", "elevacao_media_m",
    "matriculas_publicas", "matriculas_rurais_pct", "velocidade_medida_mbps",
    "alunos_maior_turno_est", "escolas_sem_internet_aprendizagem", "ivs",
    "tem_backhaul_fibra", "acordo_migracao", "fust_elegivel", "eace_escolas",
    "alunos_sem_internet", "semiarido", "ubs",
]


def _data_quality(df: pd.DataFrame) -> pd.DataFrame:
    """Classifica cada campo: coluna constante = fallback neutro (sem informação)."""
    rows = []
    for campo in _CAMPOS_QUALIDADE:
        serie = df[campo]
        if serie.nunique() <= 1:
            tipo, cobertura = "neutro", 0.0
        else:
            tipo = "aproximado" if campo in _APROXIMADOS else "real"
            cobertura = float((serie != serie.mode().iloc[0]).mean())
        rows.append((campo, tipo, round(cobertura, 4)))
    return pd.DataFrame(rows, columns=["campo", "tipo", "cobertura"])


def _write_sqlite(
    df_municipios: pd.DataFrame,
    df_escolas: pd.DataFrame,
    output_path: Path,
    df_inep_agg: pd.DataFrame | None = None,
    extras: dict[str, pd.DataFrame | None] | None = None,
) -> None:
    """Cria o SQLite final com as tabelas municipios, escolas e validacao_localizacao."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Escreve num arquivo temporário e troca no final: a API nunca vê um banco ausente ou pela metade
    # (um reload durante o ETL fazia a API cair no mock sem avisar).
    final_path = output_path
    output_path = final_path.with_name(final_path.name + ".tmp")
    output_path.unlink(missing_ok=True)

    con = sqlite3.connect(output_path)
    con.execute("PRAGMA foreign_keys=ON")

    # --- Tabela municipios ---
    con.execute("""
        CREATE TABLE municipios (
            codigo_ibge                     TEXT PRIMARY KEY,
            municipio                       TEXT NOT NULL,
            uf                              TEXT NOT NULL,
            total_escolas                   INTEGER DEFAULT 0,
            escolas_sem_internet            INTEGER DEFAULT 0,
            escolas_sem_banda_larga         INTEGER DEFAULT 0,
            escolas_com_medicao             INTEGER DEFAULT 0,
            velocidade_media_escolas_mbps   REAL,
            total_acessos                   INTEGER DEFAULT 0,
            acessos_ftth                    INTEGER DEFAULT 0
        )
    """)

    # --- Tabela escolas ---
    con.execute("""
        CREATE TABLE escolas (
            CO_ENTIDADE     TEXT PRIMARY KEY,
            NO_ENTIDADE     TEXT,
            CO_MUNICIPIO    TEXT,
            NO_MUNICIPIO    TEXT,
            SG_UF           TEXT,
            IN_INTERNET     INTEGER DEFAULT 0,
            latitude        REAL,
            longitude       REAL
        )
    """)

    # --- Tabela validacao_localizacao ---
    con.execute("""
        CREATE TABLE validacao_localizacao (
            CO_ENTIDADE         TEXT PRIMARY KEY,
            status_localizacao  TEXT
        )
    """)

    # Índice de agregados INEP por município
    inep_idx: dict = {}
    if df_inep_agg is not None and not df_inep_agg.empty:
        for _, r in df_inep_agg.iterrows():
            inep_idx[str(r["id_municipio"]).zfill(7)] = r

    # --- Insere municípios ---
    mun_rows = []
    for _, row in df_municipios.iterrows():
        ibge = str(row["id_municipio"])
        inep = inep_idx.get(ibge, {})
        mun_rows.append((
            ibge,
            str(row["nome"]),
            str(row["uf"]),
            int(inep.get("total_escolas", 0)) if hasattr(inep, "get") else 0,
            int(inep.get("escolas_sem_internet", 0)) if hasattr(inep, "get") else 0,
            int(inep.get("escolas_sem_banda_larga", 0)) if hasattr(inep, "get") else 0,
            0,  # escolas_com_medicao — preenchido quando NIC.br estiver disponível
            float(row.get("velocidade_medida_mbps", 0.0)) or None,
            int(row.get("acessos_total_bl", 0)),
            int(row.get("acessos_fibra", 0)),
        ))

    con.executemany("""
        INSERT OR IGNORE INTO municipios
        (codigo_ibge, municipio, uf, total_escolas, escolas_sem_internet,
         escolas_sem_banda_larga, escolas_com_medicao, velocidade_media_escolas_mbps,
         total_acessos, acessos_ftth)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, mun_rows)
    logger.info("Municípios inseridos: %d", len(mun_rows))

    # --- Insere escolas ---
    esc_rows = []
    for _, row in df_escolas.iterrows():
        esc_rows.append((
            str(row["CO_ENTIDADE"]),
            str(row.get("NO_ENTIDADE", "")),
            str(row["CO_MUNICIPIO"]).zfill(7),
            str(row.get("NO_MUNICIPIO", "")),
            str(row.get("SG_UF", "")),
            int(row.get("IN_INTERNET", 0)),
            row.get("latitude") if pd.notna(row.get("latitude")) else None,
            row.get("longitude") if pd.notna(row.get("longitude")) else None,
        ))

    con.executemany("""
        INSERT OR IGNORE INTO escolas
        (CO_ENTIDADE, NO_ENTIDADE, CO_MUNICIPIO, NO_MUNICIPIO, SG_UF, IN_INTERNET, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, esc_rows)
    logger.info("Escolas inseridas: %d", len(esc_rows))

    # --- Tabelas do motor (scores, financeiro, otimização) ---
    engine = df_municipios.drop(columns=["dist_backhaul_km"], errors="ignore")
    engine.to_sql("municipios_engine", con, index=False)
    engine.loc[engine["tem_backhaul_fibra"], ["id_municipio", "lat", "lon"]].to_sql(
        "backhaul", con, index=False
    )
    _data_quality(engine).to_sql("data_quality", con, index=False)
    # bl_2021: base do backtest; provedores: construir × comprar; ubs: módulo Saúde
    for nome, tabela in (extras or {}).items():
        if tabela is not None:
            tabela.to_sql(nome, con, index=False)
    for campo, tipo, _ in _data_quality(engine).itertuples(index=False):
        if tipo != "real":
            logger.warning("Qualidade: %s = %s", campo, tipo)

    con.commit()
    con.close()

    for sufixo in ("-wal", "-shm"):  # restos do banco anterior (modo WAL) não valem para o novo arquivo
        final_path.with_name(final_path.name + sufixo).unlink(missing_ok=True)
    os.replace(output_path, final_path)

    size_mb = final_path.stat().st_size / 1e6
    logger.info("SQLite criado: %s (%.1f MB)", final_path, size_mb)


def run(output_path: Path | None = None) -> None:
    """Pipeline completo: steps 1–8 → validação → SQLite."""
    if output_path is None:
        env_path = os.getenv("CONECTA_SQLITE_PATH", "").strip()
        output_path = Path(env_path) if env_path else DEFAULT_DB

    logger.info("Saída: %s", output_path)

    df_municipios, df_escolas, df_inep_agg, extras = _run_all_steps()
    df_valid, errors = _validate_schema(df_municipios)

    if len(df_valid) < 5000:
        raise RuntimeError(
            f"Apenas {len(df_valid)} municípios válidos — menos que 5.000. "
            "Verifique os erros acima antes de sobrescrever o banco."
        )

    _write_sqlite(df_valid, df_escolas, output_path, df_inep_agg=df_inep_agg, extras=extras)
    documentos, trechos = build_index()  # sem o índice, a busca de documentos do agente fica indisponível
    logger.info("Índice RAG: %d documentos, %d trechos", documentos, trechos)
    logger.info(
        "ETL concluído: %d municípios, %d erros de validação → %s",
        len(df_valid), len(errors), output_path,
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    parser = argparse.ArgumentParser(description="ETL completo do Conecta+")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Caminho do SQLite de saída (padrão: engine/data/conecta_mais.db)",
    )
    args = parser.parse_args()
    run(args.output)
