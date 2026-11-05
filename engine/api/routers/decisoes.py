"""
Registro de decisões do gestor por município (aprovar, adiar ou descartar).

Só inclusão: o histórico nunca é apagado e a decisão mais recente é a vigente. Os números
(CapEx, payback, VPL, quadrante, score) são recalculados aqui com o cenário enviado, nunca
aceitos do cliente. Banco separado do ETL, que regenera o conecta_mais.db.
"""
from __future__ import annotations

import json
import math
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from conecta.data.escopo import Regiao
from conecta.financial.models import Alavancas, FinancialParams
from conecta.optimizer.portfolio import add_financials

router = APIRouter(tags=["decisoes"])

DEFAULT_DB = Path(__file__).resolve().parents[2] / "data" / "decisoes.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS decisoes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    id_municipio      TEXT NOT NULL,
    decisao           TEXT NOT NULL CHECK (decisao IN ('aprovar', 'adiar', 'descartar')),
    motivo            TEXT NOT NULL,
    observacao_campo  TEXT,
    responsavel       TEXT NOT NULL,
    criado_em         TEXT NOT NULL,
    cenario           TEXT NOT NULL,
    numeros           TEXT NOT NULL,
    situacao_no_plano TEXT,
    justificativa_ia  TEXT,
    fonte_dados       TEXT NOT NULL
)
"""
_COLUNAS = (
    "id_municipio", "decisao", "motivo", "observacao_campo", "responsavel", "criado_em",
    "cenario", "numeros", "situacao_no_plano", "justificativa_ia", "fonte_dados",
)


def _conexao() -> sqlite3.Connection:
    con = sqlite3.connect(Path(os.getenv("CONECTA_DECISOES_PATH") or DEFAULT_DB))
    con.row_factory = sqlite3.Row
    con.execute(_SCHEMA)
    return con


class Escopo(BaseModel):
    uf: Optional[str] = Field(None, pattern=r"^[A-Z]{2}$")
    regiao: Optional[Regiao] = None
    semiarido: bool = False


class Cenario(BaseModel):
    orcamento_mi: float = Field(gt=0, le=1_000_000)
    objetivo: Literal["retorno", "equilibrado", "alunos"]
    escopo: Escopo = Escopo()
    params: FinancialParams = FinancialParams()
    alavancas: Alavancas = Alavancas()


class NovaDecisao(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id_municipio: str = Field(pattern=r"^\d{7}$")
    decisao: Literal["aprovar", "adiar", "descartar"]
    motivo: str = Field(min_length=10, max_length=2000)
    observacao_campo: Optional[str] = Field(None, max_length=2000)
    responsavel: str = Field(min_length=2, max_length=100)
    cenario: Cenario
    situacao_no_plano: Optional[str] = Field(None, max_length=300)
    justificativa_ia: Optional[str] = Field(None, max_length=4000)


def _linha(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["cenario"], d["numeros"] = json.loads(d["cenario"]), json.loads(d["numeros"])
    return d


@router.post("/decisoes", status_code=201)
def post_decisao(body: NovaDecisao, request: Request) -> dict:
    df = request.app.state.municipios
    linha = df[df["id_municipio"].astype(str) == body.id_municipio]
    if linha.empty:
        raise HTTPException(status_code=404, detail="Município não encontrado no motor.")
    fin = add_financials(linha, body.cenario.params, body.cenario.alavancas).iloc[0]
    payback = float(fin["_payback"])
    registro = {
        **body.model_dump(exclude={"cenario"}),
        "observacao_campo": body.observacao_campo or None,
        "criado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cenario": body.cenario.model_dump(),
        "numeros": {
            "capex_mi": round(float(fin["_capex"]), 3),
            "payback_anos": round(payback, 2) if math.isfinite(payback) else None,
            "vpl_mi": round(float(fin["_npv"]), 3),
            "quadrante": str(fin["quadrante"]),
            "score_total": round(float(fin["score_total"]), 1),
        },
        "fonte_dados": request.app.state.fonte_dados,
    }
    valores = [
        json.dumps(registro[c], ensure_ascii=False) if c in ("cenario", "numeros") else registro[c]
        for c in _COLUNAS
    ]
    with closing(_conexao()) as con, con:
        cur = con.execute(
            f"INSERT INTO decisoes ({', '.join(_COLUNAS)}) "
            f"VALUES ({', '.join('?' * len(_COLUNAS))})",
            valores,
        )
        registro["id"] = cur.lastrowid
    return registro


@router.get("/decisoes")
def get_decisoes(id_municipio: Optional[str] = Query(None, pattern=r"^\d{7}$")) -> list[dict]:
    """Com `id_municipio`: histórico do município (mais recente primeiro).

    Sem ele: a decisão vigente de cada município.
    """
    with closing(_conexao()) as con:
        if id_municipio:
            rows = con.execute(
                "SELECT * FROM decisoes WHERE id_municipio = ? ORDER BY id DESC", (id_municipio,)
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM decisoes WHERE id IN "
                "(SELECT MAX(id) FROM decisoes GROUP BY id_municipio) ORDER BY id DESC"
            ).fetchall()
    return [_linha(r) for r in rows]
