"""
Cálculo dos scores M, I, C, A e classificação em quadrantes.

Cada score é normalizado em [0, 100] usando min-max sobre o conjunto
de municípios recebido (escala relativa ao recorte, não global).
Quando a base real do Joel chegar, basta passar o DataFrame completo
dos 5.570 municípios para obter a escala nacional.

Quadrantes (alinhados com o mockup do Joel):
  Q1  — M alto + I alto           → Expandir já           (#138a5b verde)
  Q2a — M baixo + I alto + A > 0  → Expandir c/ alavancas (#2b6cb0 azul)
  Q2b — M baixo + I alto + A == 0 → Satélite / grant      (#d9822b laranja)
  Q3  — M alto + I baixo          → Comercial / M&A        (#bf9000 amarelo)
  Q4  — M baixo + I baixo         → Monitorar             (#8a94a3 cinza)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from conecta.scores.models import ScoreWeights

# Constante da proposta §4.1: velocidade mínima por aluno (Mbps)
MBPS_POR_ALUNO = 1.0
# Velocidade mínima por escola (Mbps), independente do tamanho
VELOCIDADE_MINIMA_ESCOLA_MBPS = 50.0


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _minmax(series: pd.Series) -> pd.Series:
    """Normaliza uma série para [0, 100]. Série constante vira 50."""
    lo, hi = series.min(), series.max()
    if hi == lo:
        return pd.Series(50.0, index=series.index)
    return (series - lo) / (hi - lo) * 100


def _deficit_banda(df: pd.DataFrame) -> pd.Series:
    """
    Déficit de banda por município (Mbps), agregando todas as escolas.

    Fórmula por escola (§4.1):
        necessidade = max(alunos_maior_turno * 1 Mbps, 50 Mbps)
        déficit     = max(necessidade - velocidade_medida, 0)

    Como os dados são agregados por município (não por escola individual),
    usamos alunos_maior_turno_est e velocidade_medida_mbps como proxies
    municipais. O déficit é calculado por município e normalizado.
    """
    necessidade = np.maximum(
        df["alunos_maior_turno_est"] * MBPS_POR_ALUNO,
        VELOCIDADE_MINIMA_ESCOLA_MBPS,
    )
    return np.maximum(necessidade - df["velocidade_medida_mbps"], 0.0)


# ---------------------------------------------------------------------------
# Scores individuais
# ---------------------------------------------------------------------------

def _score_M(df: pd.DataFrame) -> pd.Series:
    """
    Potencial de Mercado.

    Componentes (§4.1):
    - Domicílios urbanos (volume de mercado)
    - Renda média domiciliar
    - Gap de fibra: domicílios sem fibra = 1 - penetração_fibra
    - Market share móvel da Vivo (base endereçável Vivo Total)
    - HHI invertido: mercado menos concentrado = mais oportunidade
    - PPP share invertido: mais PPP = mercado mais disputado = menos atrativo
    """
    penetracao_fibra = df["acessos_fibra"] / df["domicilios_urbanos"].clip(lower=1)
    gap_fibra = 1.0 - penetracao_fibra.clip(upper=1.0)

    raw = (
        _minmax(df["domicilios_urbanos"]) * 0.25
        + _minmax(df["renda_media"]) * 0.20
        + _minmax(gap_fibra) * 0.20
        + _minmax(df["market_share_vivo_movel"]) * 0.20
        + _minmax(10000.0 - df["hhi"]) * 0.10       # HHI invertido
        + _minmax(1.0 - df["ppp_share"]) * 0.05     # PPP share invertido
    )
    return raw.clip(0, 100).rename("score_M")


def _score_I(df: pd.DataFrame) -> pd.Series:
    """
    Impacto Educacional.

    Componentes (§4.1):
    - Matrículas públicas absolutas
    - Percentual de matrículas rurais (acesso mais difícil = maior impacto)
    - Déficit de banda calculado (§4.1 fórmula)
    - Escolas sem internet para aprendizagem
    - IVS (vulnerabilidade social — maior = maior impacto)
    """
    deficit = _deficit_banda(df)

    raw = (
        _minmax(df["matriculas_publicas"]) * 0.20
        + _minmax(df["matriculas_rurais_pct"]) * 0.15
        + _minmax(deficit) * 0.35
        + _minmax(df["escolas_sem_internet_aprendizagem"]) * 0.15
        + _minmax(df["ivs"]) * 0.15
    )
    return raw.clip(0, 100).rename("score_I")


def _score_C(df: pd.DataFrame) -> pd.Series:
    """
    Custo Estimado de Implantação — invertido (custo menor = score maior).

    Componentes (§4.1):
    - Distância ao backhaul (proxy de custo de backhaul)
      → usa dist_backhaul_km se calculado, senão 0 para quem já tem backhaul
    - Densidade domiciliar (domicilios_urbanos / area_km2) — invertida:
      mais densa = rede de acesso mais barata por domicílio
    - Elevação média (relevo) — maior elevação = maior custo de implantação

    O score final é invertido: custo alto → score_C baixo.
    """
    dist_km = pd.to_numeric(df["dist_backhaul_km"], errors="coerce").fillna(0.0)

    densidade = df["domicilios_urbanos"] / df["area_km2"].clip(lower=0.01)

    custo_proxy = (
        _minmax(dist_km) * 0.50
        + _minmax(1.0 / densidade.clip(lower=0.01)) * 0.30   # inverso da densidade
        + _minmax(df["elevacao_media_m"]) * 0.20
    )
    # Inverter: custo alto → score baixo
    score = 100.0 - custo_proxy.clip(0, 100)
    return score.rename("score_C")


def _score_A(df: pd.DataFrame) -> pd.Series:
    """
    Alavancas Financeiras e Regulatórias.

    Componentes (§4.1):
    - Acordo de migração (backhaul comprometido) — peso maior
    - Elegibilidade ao FUST
    - Cobertura pelo EACE/Aprender Conectado
    """
    acordo = df["acordo_migracao"].astype(float) * 50.0   # peso 50 pts
    fust   = df["fust_elegivel"].astype(float) * 30.0     # peso 30 pts
    eace   = _minmax(df["eace_escolas"]) * 0.20           # peso 20 pts (normalizado)

    raw = (acordo + fust + eace).clip(0, 100)
    return raw.rename("score_A")


# ---------------------------------------------------------------------------
# Quadrantes
# ---------------------------------------------------------------------------

def _classificar_quadrante(df: pd.DataFrame) -> pd.Series:
    """
    Classifica cada município em Q1, Q2a, Q2b, Q3 ou Q4.

    Eixos: mediana de score_M e score_I no recorte atual.
    Q2a vs Q2b: depende de score_A > 0 (há pelo menos uma alavanca).
    """
    med_M = df["score_M"].median()
    med_I = df["score_I"].median()

    alto_M = df["score_M"] >= med_M
    alto_I = df["score_I"] >= med_I
    tem_alavanca = df["score_A"] > 0

    conditions = [
        alto_M & alto_I,
        ~alto_M & alto_I & tem_alavanca,
        ~alto_M & alto_I & ~tem_alavanca,
        alto_M & ~alto_I,
    ]
    choices = ["Q1", "Q2a", "Q2b", "Q3"]
    return pd.Series(
        np.select(conditions, choices, default="Q4"),
        index=df.index,
        name="quadrante",
    )


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

def calculate_scores(
    df: pd.DataFrame,
    weights: ScoreWeights | None = None,
) -> pd.DataFrame:
    """
    Calcula os quatro scores e classifica em quadrantes.

    Args:
        df: DataFrame validado pelo loader (campos do schema Municipio).
        weights: Pesos dos índices. Se None, usa pesos iguais (0.25 cada).

    Returns:
        DataFrame original acrescido das colunas:
        score_M, score_I, score_C, score_A, score_total, quadrante,
        deficit_banda_mbps.
    """
    if weights is None:
        weights = ScoreWeights()

    out = df.copy()

    out["deficit_banda_mbps"] = _deficit_banda(df)
    out["score_M"] = _score_M(df)
    out["score_I"] = _score_I(df)
    out["score_C"] = _score_C(df)
    out["score_A"] = _score_A(df)

    out["score_total"] = (
        weights.w_M * out["score_M"]
        + weights.w_I * out["score_I"]
        + weights.w_C * out["score_C"]
        + weights.w_A * out["score_A"]
    )

    out["quadrante"] = _classificar_quadrante(out)

    return out
