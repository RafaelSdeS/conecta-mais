"""
Carrega e valida as bases de dados do Conecta+.

Qualquer fonte (CSV, Parquet, GeoParquet) passa por aqui antes de
chegar nos módulos de cálculo. A validação Pydantic garante que um
dado malformado falha cedo com uma mensagem clara.
"""

from __future__ import annotations

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
