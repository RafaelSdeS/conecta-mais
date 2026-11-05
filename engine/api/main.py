"""
API FastAPI do Conecta+.

Lifespan:
  - Carrega os dados reais do SQLite do ETL (municipios_engine + backhaul) quando
    existem; senão usa mock_municipios.csv e mock_backhaul.csv (fallback demonstrativo).
  - Calcula distâncias ao backhaul e scores (pesos padrão).
  - Guarda tudo em app.state para os routers reutilizarem sem I/O repetido.

Endpoints:
  GET  /municipios          → lista com scores, filtros por uf e quadrante
  POST /scores              → recalcula scores com pesos customizados
  POST /financial           → business case de um município
  POST /portfolio           → otimiza portfólio (PuLP/CBC)
  GET  /backtest            → resultado do backtest pré-calculado
  POST/GET /decisoes        → registro de decisões do gestor (SQLite próprio)
  GET  /health              → healthcheck
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

import pandas as pd
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from api.routers import backtest, chat, dados, decisoes, financial, ia, municipios, portfolio, scores

logger = logging.getLogger("uvicorn.error")
DATA_DIR = Path(__file__).parent.parent / "data"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carrega e pré-processa os dados na inicialização."""
    from conecta.data.loader import (
        has_engine_data,
        load_backhaul,
        load_backhaul_db,
        load_bl_2021,
        load_data_quality,
        load_municipios,
        load_municipios_db,
    )
    from conecta.geo.distances import add_backhaul_distances
    from conecta.scores.calculator import calculate_scores

    db = Path(os.getenv("CONECTA_SQLITE_PATH") or DATA_DIR / "conecta_mais.db")
    if has_engine_data(db):
        fonte = "real"
        mun, bh = load_municipios_db(db), load_backhaul_db(db)
        app.state.qualidade_dados = load_data_quality(db)
        app.state.bl_2021 = load_bl_2021(db)
    else:
        fonte = "mock"  # fallback demonstrativo só quando não há base real
        logger.warning(
            "Base real não encontrada em %s: usando dados DEMONSTRATIVOS. "
            "Rode `python -m etl.run_etl` e reinicie a API.", db,
        )
        mun = load_municipios(DATA_DIR / "mock_municipios.csv")
        bh  = load_backhaul(DATA_DIR / "mock_backhaul.csv")
        app.state.qualidade_dados = []
        app.state.bl_2021 = None

    mun = add_backhaul_distances(mun, bh)
    mun = calculate_scores(mun)
    mun.attrs["fonte"] = fonte
    mun.attrs["qualidade"] = app.state.qualidade_dados
    app.state.fonte_dados = fonte

    app.state.municipios = mun    # DataFrame com scores e dist_backhaul_km
    app.state.backhaul   = bh

    yield
    # Cleanup (nenhum recurso externo a liberar no MVP)


app = FastAPI(
    title="Conecta+ Engine",
    description="Motor de scores, financeiro e otimização — IBM SkillsBuild & Fundação Telefônica Vivo",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(municipios.router)
app.include_router(scores.router)
app.include_router(financial.router)
app.include_router(portfolio.router)
app.include_router(backtest.router)
app.include_router(dados.router)
app.include_router(chat.router)
app.include_router(ia.router)
app.include_router(decisoes.router)


@app.get("/qualidade", tags=["infra"])
def qualidade(request: Request):
    """Estado de cada campo do motor (real, aproximado ou neutro), registrado pelo ETL."""
    return {"fonte_dados": request.app.state.fonte_dados, "campos": request.app.state.qualidade_dados}


@app.get("/health", tags=["infra"])
def health(request: Request):
    return {"status": "ok", "fonte_dados": request.app.state.fonte_dados}
