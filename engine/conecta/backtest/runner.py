"""
Backtest 2021 → 2025 do modelo de scores do Conecta+.

Lógica:
1. Calcula os scores com dados de 2021 e classifica os municípios em quadrantes.
2. Define "crescimento real de fibra" como acessos_fibra_2025 > acessos_fibra_2021 × 1.2
   (crescimento acima de 20% — threshold ajustável).
3. Trata os municípios em Q1 ou Q2a como "predição positiva" do modelo.
4. Calcula precision e recall dessa predição contra o crescimento real observado.

Interpretação (§8.1 Módulo 5 da proposta):
- Precision alta  → quando o modelo diz "expandir", de fato havia crescimento.
- Recall alto     → o modelo captura a maioria dos municípios que cresceram.
- É a "principal evidência de que o modelo funciona" para o pitch.

Quando o Joel entregar a série histórica real da Anatel:
  - Substituir data_2021 e data_2025 pelos DataFrames reais.
  - O resto do código não muda.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from conecta.geo.distances import add_backhaul_distances
from conecta.scores.calculator import calculate_scores
from conecta.scores.models import ScoreWeights


@dataclass
class BacktestResult:
    """Métricas do backtest 2021 → 2025."""

    precision: float
    recall: float
    f1: float
    total_q1_q2a_2021: int       # municípios em Q1 ou Q2a pelo modelo de 2021
    total_cresceram: int          # municípios que cresceram de fato até 2025
    acertados: int                # interseção: Q1/Q2a em 2021 E cresceram até 2025
    threshold_crescimento: float  # multiplicador usado (padrão 1.2)
    detalhes: pd.DataFrame = field(repr=False)   # linha por município com flags


def run_backtest(
    data_2021: pd.DataFrame,
    data_2025: pd.DataFrame,
    backhaul_df: pd.DataFrame,
    weights: ScoreWeights | None = None,
    threshold_crescimento: float = 1.2,
) -> BacktestResult:
    """
    Executa o backtest comparando scores de 2021 com crescimento real até 2025.

    Args:
        data_2021:             DataFrame carregado do CSV de 2021 (sem dist_backhaul_km).
        data_2025:             DataFrame carregado do CSV de 2025 (dados atuais).
        backhaul_df:           DataFrame com municípios que têm backhaul (lat, lon, id_municipio).
        weights:               Pesos dos scores (padrão: iguais).
        threshold_crescimento: Crescimento mínimo de fibra para considerar "expandiu".
                               1.2 = 20% acima do nível de 2021.

    Returns:
        BacktestResult com precision, recall, f1 e DataFrame de detalhes.
    """
    # ── 1. Calcular scores com dados de 2021 ─────────────────────────────────
    d21 = add_backhaul_distances(data_2021, backhaul_df)
    d21 = calculate_scores(d21, weights=weights)

    # ── 2. Definir crescimento real (série 2025) ──────────────────────────────
    fibra_2021 = data_2021.set_index("id_municipio")["acessos_fibra"]
    fibra_2025 = data_2025.set_index("id_municipio")["acessos_fibra"]

    # Municípios presentes em ambas as séries
    ids_comuns = fibra_2021.index.intersection(fibra_2025.index)

    cresceu = (
        fibra_2025.loc[ids_comuns] > fibra_2021.loc[ids_comuns] * threshold_crescimento
    )

    # ── 3. Predição do modelo: Q1 ou Q2a em 2021 ─────────────────────────────
    scores_2021 = d21.set_index("id_municipio")[["quadrante"]].loc[ids_comuns]
    previsto_positivo = scores_2021["quadrante"].isin(["Q1", "Q2a"])

    # ── 4. Métricas ───────────────────────────────────────────────────────────
    tp = int((previsto_positivo & cresceu).sum())   # Verdadeiro Positivo
    fp = int((previsto_positivo & ~cresceu).sum())  # Falso Positivo
    fn = int((~previsto_positivo & cresceu).sum())  # Falso Negativo

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = (
        2 * precision * recall / (precision + recall)
        if (precision + recall) > 0 else 0.0
    )

    # ── 5. DataFrame de detalhes por município ────────────────────────────────
    detalhes = pd.DataFrame({
        "id_municipio":     ids_comuns,
        "quadrante_2021":   scores_2021["quadrante"].values,
        "previsto_positivo": previsto_positivo.values,
        "cresceu":          cresceu.values,
        "acessos_fibra_2021": fibra_2021.loc[ids_comuns].values,
        "acessos_fibra_2025": fibra_2025.loc[ids_comuns].values,
    })

    return BacktestResult(
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        total_q1_q2a_2021=int(previsto_positivo.sum()),
        total_cresceram=int(cresceu.sum()),
        acertados=tp,
        threshold_crescimento=threshold_crescimento,
        detalhes=detalhes,
    )
