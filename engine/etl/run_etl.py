"""
Orquestrador principal do ETL Conecta+.

Executa todos os steps em sequência, junta os dados, valida contra o schema
Pydantic (Municipio) e grava o SQLite final com as tabelas:
  - municipios (5.570 linhas)
  - escolas   (137.847 linhas)
  - validacao_localizacao (vazia — preenchida por step futuro de geocodificação)

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

    # --- Junta tudo na base de municípios ---
    logger.info("=== Juntando todos os dados ===")
    df = df_base.copy()

    for other, cols in [
        (df_ivs, ["ivs"]),
        (df_backhaul, ["tem_backhaul_fibra"]),
        (df_bl, ["domicilios_urbanos", "renda_media", "acessos_total_bl", "acessos_fibra",
                  "market_share_vivo_movel", "hhi", "ppp_share"]),
        (df_inep_mun, ["total_escolas", "matriculas_publicas", "matriculas_rurais_pct",
                       "alunos_maior_turno_est", "escolas_sem_internet",
                       "escolas_sem_internet_aprendizagem", "escolas_sem_banda_larga"]),
        (df_vel, ["velocidade_medida_mbps"]),
        (df_elev, ["elevacao_media_m"]),
        (df_alav, ["acordo_migracao", "ano_backhaul", "fust_elegivel", "eace_escolas"]),
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
        "velocidade_medida_mbps": 0.0,
        "elevacao_media_m": 400.0,
        "acordo_migracao": False,
        "fust_elegivel": False,
        "eace_escolas": 0,
    }
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
    df["total_escolas"] = df["total_escolas"].astype(int)
    df["tem_backhaul_fibra"] = df["tem_backhaul_fibra"].astype(bool)
    df["acordo_migracao"] = df["acordo_migracao"].astype(bool)
    df["fust_elegivel"] = df["fust_elegivel"].astype(bool)

    logger.info("DataFrame final: %d municípios, %d colunas", len(df), len(df.columns))
    return df, df_escolas, df_inep_mun


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


def _write_sqlite(
    df_municipios: pd.DataFrame,
    df_escolas: pd.DataFrame,
    output_path: Path,
    df_inep_agg: pd.DataFrame | None = None,
) -> None:
    """Cria o SQLite final com as tabelas municipios, escolas e validacao_localizacao."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Remove banco anterior se existir
    if output_path.exists():
        output_path.unlink()
        logger.info("Banco anterior removido: %s", output_path)

    con = sqlite3.connect(output_path)
    con.execute("PRAGMA journal_mode=WAL")
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

    con.commit()
    con.close()

    size_mb = output_path.stat().st_size / 1e6
    logger.info("SQLite criado: %s (%.1f MB)", output_path, size_mb)


def run(output_path: Path | None = None) -> None:
    """Pipeline completo: steps 1–8 → validação → SQLite."""
    if output_path is None:
        env_path = os.getenv("CONECTA_SQLITE_PATH", "").strip()
        output_path = Path(env_path) if env_path else DEFAULT_DB

    logger.info("Saída: %s", output_path)

    df_municipios, df_escolas, df_inep_agg = _run_all_steps()
    df_valid, errors = _validate_schema(df_municipios)

    if len(df_valid) < 5000:
        raise RuntimeError(
            f"Apenas {len(df_valid)} municípios válidos — menos que 5.000. "
            "Verifique os erros acima antes de sobrescrever o banco."
        )

    _write_sqlite(df_valid, df_escolas, output_path, df_inep_agg=df_inep_agg)
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
