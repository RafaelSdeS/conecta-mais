"""Filtros de escopo compartilhados pela API e pelas ferramentas do agente."""

from __future__ import annotations

from typing import Literal

import pandas as pd

Regiao = Literal["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"]
_REGIAO_POR_DIGITO = {"1": "Norte", "2": "Nordeste", "3": "Sudeste", "4": "Sul", "5": "Centro-Oeste"}


def filtrar_escopo(
    df: pd.DataFrame,
    uf: str | None = None,
    semiarido: bool = False,
    regiao: Regiao | None = None,
) -> pd.DataFrame:
    """Restringe os municípios por UF, Semiárido e/ou região (pelo 1º dígito do código IBGE)."""
    if uf:
        df = df[df["uf"].str.upper() == uf.upper()]
    if semiarido and "semiarido" in df.columns:
        df = df[df["semiarido"].astype(bool)]
    if regiao:
        df = df[df["id_municipio"].astype(str).str[0].map(_REGIAO_POR_DIGITO) == regiao]
    return df
