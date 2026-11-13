"""
Step 10 — Acessos reais da Anatel por município (banda larga fixa e telefonia móvel).

Fonte: painéis de dados abertos da Anatel
  https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/acessos_banda_larga_fixa.zip
  https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/acessos_telefonia_movel.zip
Os zips são grandes (1–3 GB); lemos só os membros necessários por faixas de bytes (etl/remote_zip.py).

Produz:
  - anatel_acessos.parquet: [id_municipio, acessos_total_bl, acessos_fibra, hhi, ppp_share,
    market_share_vivo_movel] no último mês publicado.
      acessos_*  = banda larga fixa de pessoa física, produto Internet (Meio de Acesso = Fibra para fibra)
      hhi        = Σ (participação do grupo econômico)² × 10.000
      ppp_share  = participação de prestadoras de pequeno porte
      market_share_vivo_movel = acessos móveis da Telefônica (Vivo) / total, sem M2M
  - anatel_provedores.parquet: [id_municipio, empresa, cnpj, grupo, porte, acessos, acessos_fibra]
    provedores de banda larga fixa por município (base do "construir × comprar").
  - anatel_bl_2021.parquet: [id_municipio, acessos_total_bl, acessos_fibra] em dezembro de 2021,
    base do backtest 2021→hoje.
Municípios sem nenhum acesso no arquivo têm acessos 0; HHI, PPP e share ficam vazios e o orquestrador
preenche com a mediana nacional.
"""

from __future__ import annotations

import logging
import re

import pandas as pd

from etl.remote_zip import open_zip
from etl.utils import RAW_DIR

logger = logging.getLogger(__name__)

CACHE_ATUAL = RAW_DIR / "anatel_acessos.parquet"
CACHE_2021 = RAW_DIR / "anatel_bl_2021.parquet"
CACHE_PROVEDORES = RAW_DIR / "anatel_provedores.parquet"
BASE = "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/"
BL_ZIP = BASE + "acessos_banda_larga_fixa.zip"
MOVEL_ZIP = BASE + "acessos_telefonia_movel.zip"
_CHUNK = 1_000_000


def _agrega(zf, membro: str, colunas: dict[str, str], filtro) -> pd.DataFrame:
    """Lê o CSV em blocos, aplica o filtro e soma os acessos por (mês, município, grupo, porte, meio)."""
    partes = []
    with zf.open(membro) as f:
        for bloco in pd.read_csv(
            f, sep=";", encoding="utf-8-sig", usecols=list(colunas), dtype=str, chunksize=_CHUNK
        ):
            bloco = bloco.rename(columns=colunas)
            bloco = bloco[filtro(bloco)]
            bloco["acessos"] = pd.to_numeric(bloco["acessos"], errors="coerce").fillna(0)
            chaves = [c for c in bloco.columns if c != "acessos"]
            partes.append(bloco.groupby(chaves, as_index=False)["acessos"].sum())
    out = pd.concat(partes, ignore_index=True)
    chaves = [c for c in out.columns if c != "acessos"]
    return out.groupby(chaves, as_index=False)["acessos"].sum()


_COLS_BL = {
    "Mês": "mes", "Grupo Econômico": "grupo", "Porte da Prestadora": "porte",
    "Código IBGE Município": "id_municipio", "Meio de Acesso": "meio",
    "Empresa": "empresa", "CNPJ": "cnpj",
    "Tipo de Pessoa": "pessoa", "Tipo de Produto": "produto", "Acessos": "acessos",
}


def _filtro_bl(b: pd.DataFrame):
    return (b["pessoa"] == "Pessoa Física") & (b["produto"] == "INTERNET")


def _membro_mais_recente(nomes: list[str], padrao: str) -> str:
    candidatos = sorted(n for n in nomes if re.fullmatch(padrao, n))
    return candidatos[-1]


def _bl_resumo(df: pd.DataFrame) -> pd.DataFrame:
    """Total e fibra por município de um recorte mensal já agregado."""
    df = df.assign(fibra=df["acessos"].where(df["meio"] == "Fibra", 0))
    return df.groupby("id_municipio", as_index=False).agg(
        acessos_total_bl=("acessos", "sum"), acessos_fibra=("fibra", "sum")
    )


def _provedores(ag: pd.DataFrame) -> pd.DataFrame:
    ag = ag.assign(acessos_fibra=ag["acessos"].where(ag["meio"] == "Fibra", 0))
    chaves = ["id_municipio", "empresa", "cnpj", "grupo", "porte"]
    return ag.groupby(chaves, as_index=False)[["acessos", "acessos_fibra"]].sum()


def _bl_atual() -> tuple[pd.DataFrame, pd.DataFrame]:
    zf = open_zip(BL_ZIP)
    membro = _membro_mais_recente([i.filename for i in zf.infolist()], r"Acessos_Banda_Larga_Fixa_20\d\d\.csv")
    logger.info("Anatel BL fixa: %s", membro)
    ag = _agrega(zf, membro, _COLS_BL, _filtro_bl)
    ag = ag[ag["mes"] == ag["mes"].astype(int).max().astype(str)]
    logger.info("Anatel BL fixa: mês %s, %d municípios", ag["mes"].iloc[0], ag["id_municipio"].nunique())

    base = _bl_resumo(ag)
    por_grupo = ag.groupby(["id_municipio", "grupo"], as_index=False)["acessos"].sum()
    por_grupo["part"] = por_grupo["acessos"] / por_grupo.groupby("id_municipio")["acessos"].transform("sum")
    hhi = (por_grupo["part"] ** 2 * 10_000).groupby(por_grupo["id_municipio"]).sum().rename("hhi")
    pequeno = ag.assign(p=ag["acessos"].where(ag["porte"] == "Pequeno Porte", 0)).groupby("id_municipio")
    ppp = (pequeno["p"].sum() / pequeno["acessos"].sum()).rename("ppp_share")
    resumo = base.merge(hhi, on="id_municipio", how="left").merge(ppp, on="id_municipio", how="left")
    return resumo, _provedores(ag)


def _bl_2021() -> pd.DataFrame:
    zf = open_zip(BL_ZIP)
    ag = _agrega(zf, "Acessos_Banda_Larga_Fixa_2021.csv", _COLS_BL, _filtro_bl)
    return _bl_resumo(ag[ag["mes"] == "12"])


def _share_vivo() -> pd.Series:
    zf = open_zip(MOVEL_ZIP)
    membro = _membro_mais_recente(
        [i.filename for i in zf.infolist()], r"Acessos_Telefonia_Movel_20\d\d_[12]S\.csv"
    )
    logger.info("Anatel móvel: %s", membro)
    cols = {
        "Mês": "mes", "Grupo Econômico": "grupo", "Código IBGE Município": "id_municipio",
        "Tipo de Produto": "produto", "Acessos": "acessos",
    }
    ag = _agrega(zf, membro, cols, lambda b: b["produto"] != "M2M")
    ag = ag[ag["mes"] == ag["mes"].astype(int).max().astype(str)]
    ag["vivo"] = ag["acessos"].where(ag["grupo"] == "TELEFONICA", 0)
    g = ag.groupby("id_municipio")
    return (g["vivo"].sum() / g["acessos"].sum()).rename("market_share_vivo_movel")


def run(municipios: pd.DataFrame | None = None) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Retorna (acessos atuais por município, banda larga de dezembro de 2021, provedores atuais)."""
    if CACHE_ATUAL.exists() and CACHE_2021.exists() and CACHE_PROVEDORES.exists():
        logger.info("Cache: anatel_acessos, anatel_bl_2021 e anatel_provedores")
        return pd.read_parquet(CACHE_ATUAL), pd.read_parquet(CACHE_2021), pd.read_parquet(CACHE_PROVEDORES)

    resumo, provedores = _bl_atual()
    atual = resumo.merge(_share_vivo().reset_index(), on="id_municipio", how="outer")
    atual["id_municipio"] = atual["id_municipio"].astype(str).str.zfill(7)
    antigo = _bl_2021()
    antigo["id_municipio"] = antigo["id_municipio"].astype(str).str.zfill(7)
    provedores["id_municipio"] = provedores["id_municipio"].astype(str).str.zfill(7)
    atual.to_parquet(CACHE_ATUAL, index=False)
    antigo.to_parquet(CACHE_2021, index=False)
    provedores.to_parquet(CACHE_PROVEDORES, index=False)
    logger.info("Anatel: %d municípios (atual), %d (2021)", len(atual), len(antigo))
    return atual, antigo, provedores


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    a, b, p = run()
    print(a.describe().T)
    print(p.groupby("porte")["acessos"].sum())
