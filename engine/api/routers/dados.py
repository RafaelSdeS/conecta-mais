"""Rotas para consultar os dados integrados mantidos no SQLite."""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, HTTPException, Path, Query, Response

from conecta.data.sqlite_repository import (
    SQLiteDataRepository,
    SQLiteDataUnavailable,
)

router = APIRouter(prefix="/dados", tags=["dados integrados"])
FONTE_DADOS = "sqlite_integrado"
T = TypeVar("T")


def _repository() -> SQLiteDataRepository:
    return SQLiteDataRepository()


def _set_source(response: Response) -> None:
    response.headers["X-Conecta-Fonte-Dados"] = FONTE_DADOS


def _query(operation: Callable[[], T]) -> T:
    try:
        return operation()
    except SQLiteDataUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/municipios")
def listar_municipios(
    response: Response,
    nome: str | None = Query(None, max_length=100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    limite: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    _set_source(response)
    total, municipios = _query(
        lambda: _repository().list_municipios(nome, uf, limite, offset)
    )
    return {
        "fonte_dados": FONTE_DADOS,
        "total": total,
        "total_retornado": len(municipios),
        "limite": limite,
        "offset": offset,
        "municipios": municipios,
    }


@router.get("/municipios/{codigo_ibge}")
def buscar_municipio(
    response: Response,
    codigo_ibge: str = Path(..., pattern=r"^\d{7}$"),
):
    _set_source(response)
    municipio = _query(lambda: _repository().get_municipio(codigo_ibge))
    if municipio is None:
        raise HTTPException(status_code=404, detail="Município não encontrado")
    return municipio


@router.get("/escolas/sem-internet")
def listar_escolas_sem_internet(
    response: Response,
    codigo_municipio: str = Query(..., pattern=r"^\d{7}$"),
    limite: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    _set_source(response)
    municipio, total, escolas = _query(
        lambda: _repository().list_escolas_sem_internet(
            codigo_municipio, limite, offset
        )
    )
    if municipio is None:
        raise HTTPException(status_code=404, detail="Município não encontrado")
    return {
        "fonte_dados": FONTE_DADOS,
        "municipio": municipio,
        "criterio": "INEP: IN_INTERNET = 0",
        "total_sem_internet": total,
        "total_retornado": len(escolas),
        "limite": limite,
        "offset": offset,
        "escolas": escolas,
    }


@router.get("/escolas")
def listar_escolas(
    response: Response,
    codigo_municipio: str | None = Query(None, pattern=r"^\d{7}$"),
    codigo_escola: str | None = Query(None, pattern=r"^\d{8}$"),
    limite: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    _set_source(response)
    total, escolas = _query(
        lambda: _repository().list_escolas(
            codigo_municipio, codigo_escola, limite, offset
        )
    )
    return {
        "fonte_dados": FONTE_DADOS,
        "total": total,
        "total_retornado": len(escolas),
        "limite": limite,
        "offset": offset,
        "escolas": escolas,
    }


@router.get("/indicadores/{codigo_ibge}")
def consultar_indicadores(
    response: Response,
    codigo_ibge: str = Path(..., pattern=r"^\d{7}$"),
):
    _set_source(response)
    indicadores = _query(
        lambda: _repository().get_indicadores(codigo_ibge)
    )
    if indicadores is None:
        raise HTTPException(status_code=404, detail="Município não encontrado")
    return {"fonte_dados": FONTE_DADOS, **indicadores}
