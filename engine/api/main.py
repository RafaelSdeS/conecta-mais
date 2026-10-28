"""
API FastAPI do Conecta+.

Lifespan:
  - Carrega mock_municipios.csv e mock_backhaul.csv uma vez na inicialização.
  - Calcula distâncias ao backhaul e scores (pesos padrão).
  - Guarda tudo em app.state para os routers reutilizarem sem I/O repetido.

Endpoints:
  GET  /municipios          → lista com scores, filtros por uf e quadrante
  POST /scores              → recalcula scores com pesos customizados
  POST /financial           → business case de um município
  POST /portfolio           → otimiza portfólio (PuLP/CBC)
  GET  /backtest            → resultado do backtest pré-calculado
  GET  /health              → healthcheck
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import backtest, financial, municipios, portfolio, scores

DATA_DIR = Path(__file__).parent.parent / "data"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carrega e pré-processa os dados na inicialização."""
    from conecta.data.loader import load_backhaul, load_municipios
    from conecta.geo.distances import add_backhaul_distances
    from conecta.scores.calculator import calculate_scores

    mun = load_municipios(DATA_DIR / "mock_municipios.csv")
    bh  = load_backhaul(DATA_DIR / "mock_backhaul.csv")

    mun = add_backhaul_distances(mun, bh)
    mun = calculate_scores(mun)

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


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}
