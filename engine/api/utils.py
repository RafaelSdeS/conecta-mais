"""Utilitários compartilhados da API."""

from __future__ import annotations

import math

import pandas as pd


def df_to_records(df: pd.DataFrame) -> list[dict]:
    """
    Converte um DataFrame para lista de dicts serializável em JSON.

    Substitui float NaN/Inf por None para evitar erros de serialização.
    """
    records = df.to_dict(orient="records")
    return [_clean_record(r) for r in records]


def _clean_record(record: dict) -> dict:
    return {
        k: (None if isinstance(v, float) and not math.isfinite(v) else v)
        for k, v in record.items()
    }
