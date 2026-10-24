"""Modelos Pydantic para o módulo de scores."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class ScoreWeights(BaseModel):
    """
    Pesos dos quatro índices. Devem somar 1.0.
    Valores padrão: pesos iguais (0.25 cada).
    """

    w_M: float = Field(0.25, ge=0.0, le=1.0, description="Peso do score de Potencial de Mercado")
    w_I: float = Field(0.25, ge=0.0, le=1.0, description="Peso do score de Impacto Educacional")
    w_C: float = Field(0.25, ge=0.0, le=1.0, description="Peso do score de Custo de Implantação")
    w_A: float = Field(0.25, ge=0.0, le=1.0, description="Peso do score de Alavancas")

    @model_validator(mode="after")
    def pesos_somam_um(self) -> "ScoreWeights":
        total = self.w_M + self.w_I + self.w_C + self.w_A
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"A soma dos pesos deve ser 1.0, mas foi {total:.6f}. "
                f"(w_M={self.w_M}, w_I={self.w_I}, w_C={self.w_C}, w_A={self.w_A})"
            )
        return self
