"""
Carrega e valida as bases de dados do Conecta+.

Qualquer fonte (CSV, Parquet, GeoParquet) passa por aqui antes de
chegar nos módulos de cálculo. A validação Pydantic garante que um
dado malformado falha cedo com uma mensagem clara.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd
from pydantic import ValidationError

from conecta.data.schema import Municipio


def load_municipios(path: str | Path) -> pd.DataFrame:
    """
    Carrega o CSV (ou Parquet) de municípios, valida cada linha contra
    o schema Municipio e devolve um DataFrame limpo.

    Raises:
        FileNotFoundError: se o arquivo não existir.
        ValueError: se alguma linha falhar na validação do schema.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    if path.suffix == ".parquet":
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path, dtype={"id_municipio": str}, keep_default_na=True)

    erros: list[str] = []
    registros_validos: list[dict] = []

    # astype(object) + where: transforma NaN em Python None antes do to_dict,
    # para que Pydantic receba None (válido) em vez de float('nan') (inválido)
    # em campos Optional[int] / Optional[float].
    records = df.astype(object).where(df.notna(), other=None).to_dict(orient="records")
    for i, row in enumerate(records):
        try:
            m = Municipio.model_validate(row)
            registros_validos.append(m.model_dump())
        except ValidationError as exc:
            erros.append(f"Linha {i + 2}: {exc.error_count()} erro(s) — {exc.errors()[0]['msg']}")

    if erros:
        resumo = "\n".join(erros[:10])
        raise ValueError(
            f"{len(erros)} linha(s) inválida(s) em {path.name}:\n{resumo}"
        )

    return pd.DataFrame(registros_validos)


def load_backhaul(path: str | Path) -> pd.DataFrame:
    """
    Carrega o CSV de municípios com backhaul de fibra (id_municipio, lat, lon).

    Raises:
        FileNotFoundError: se o arquivo não existir.
        ValueError: se as colunas obrigatórias estiverem ausentes.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    df = pd.read_csv(path, dtype={"id_municipio": str})

    colunas_obrigatorias = {"id_municipio", "lat", "lon"}
    faltando = colunas_obrigatorias - set(df.columns)
    if faltando:
        raise ValueError(f"Colunas obrigatórias ausentes em {path.name}: {faltando}")

    return df[["id_municipio", "lat", "lon"]].copy()


_BOOL_COLS = ["tem_backhaul_fibra", "acordo_migracao", "fust_elegivel"]


def _read_sql(path: str | Path, query: str) -> pd.DataFrame:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Banco não encontrado: {path}")
    with sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True) as con:
        return pd.read_sql(query, con, dtype_backend="numpy_nullable").astype(object).where(
            lambda d: d.notna(), None
        )


def has_engine_data(path: str | Path) -> bool:
    """True se o SQLite do ETL contém as tabelas do motor (municipios_engine, backhaul)."""
    try:
        df = _read_sql(path, "SELECT name FROM sqlite_master WHERE type='table'")
    except (FileNotFoundError, sqlite3.Error):
        return False
    return {"municipios_engine", "backhaul"} <= set(df["name"])


def load_municipios_db(path: str | Path) -> pd.DataFrame:
    """Municípios do motor a partir do SQLite do ETL (já validados pelo schema no ETL)."""
    df = _read_sql(path, "SELECT * FROM municipios_engine").infer_objects()
    for col in _BOOL_COLS:
        df[col] = df[col].astype(bool)
    return df


def load_backhaul_db(path: str | Path) -> pd.DataFrame:
    return _read_sql(path, "SELECT id_municipio, lat, lon FROM backhaul").infer_objects()


def load_data_quality(path: str | Path) -> list[dict]:
    """Qualidade por campo (real/aproximado/neutro); vazio se a tabela não existir."""
    try:
        return _read_sql(path, "SELECT campo, tipo, cobertura FROM data_quality").to_dict("records")
    except (FileNotFoundError, sqlite3.Error, pd.errors.DatabaseError):
        return []
