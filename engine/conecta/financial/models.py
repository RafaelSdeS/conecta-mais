"""Modelos Pydantic para a ferramenta financeira."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FinancialParams(BaseModel):
    """
    Premissas financeiras ajustáveis pelo usuário no simulador.
    Defaults alinhados com a simulação ilustrativa de §4.3 da proposta.
    """

    # Custos de rede
    custo_hp: float = Field(477.0, gt=0, description="Custo de rede de acesso por home passed (R$)")
    custo_backhaul_km: float = Field(61_800.0, gt=0, description="Custo de backhaul por km (R$)")
    custo_ativacao: float = Field(500.0, gt=0, description="Custo de ativação por cliente (R$)")

    # Demanda e receita
    adesao_pct: float = Field(0.25, gt=0, le=1.0, description="Taxa de adesão em maturidade")
    arpu_mensal: float = Field(87.70, gt=0, description="ARPU mensal residencial (R$)")
    margem_ebitda: float = Field(0.40, gt=0, le=1.0, description="Margem EBITDA")

    # Financeiro
    wacc: float = Field(0.15, gt=0, description="WACC privado (ex: 15% a.a.)")
    wacc_fust: float = Field(0.0325, gt=0, description="Custo de capital com FUST/BNDES (TR + 1,25% ≈ 3,25% a.a.)")
    anos_projeto: int = Field(10, gt=0, description="Horizonte de projeção em anos")
    aliquota_imposto: float = Field(0.34, ge=0, le=1.0, description="Alíquota efetiva de IR+CSLL")

    # Tecnologias alternativas à fibra. PREMISSAS ILUSTRATIVAS: sem fonte pública, devem ser
    # validadas com a engenharia da operadora. Só entram na comparação de tecnologias.
    fwa_custo_hp: float = Field(150.0, gt=0, description="FWA 5G: custo de rede por domicílio coberto (R$)")
    fwa_custo_cpe: float = Field(1000.0, gt=0, description="FWA 5G: CPE + instalação por cliente (R$)")
    fwa_arpu: float = Field(80.0, gt=0, description="FWA 5G: ARPU mensal (R$)")
    fwa_margem: float = Field(0.35, gt=0, le=1.0, description="FWA 5G: margem EBITDA")
    sat_custo_terminal: float = Field(2500.0, gt=0, description="Satélite: terminal + instalação por cliente (R$)")
    sat_arpu: float = Field(150.0, gt=0, description="Satélite: ARPU mensal (R$)")
    sat_margem: float = Field(0.25, gt=0, le=1.0, description="Satélite: margem EBITDA (capacidade espacial)")


class Alavancas(BaseModel):
    """Alavancas financeiras e regulatórias disponíveis por município."""

    backhaul_comprometido: bool = Field(
        False,
        description="Município no acordo de migração: CapEx de backhaul zerado",
    )
    fust_reembolsavel: bool = Field(
        False,
        description="Financia parte do CapEx via FUST/BNDES: substitui WACC por wacc_fust no VPL",
    )
    receita_escolar: bool = Field(
        False,
        description="Inclui receita B2G de escolas (só quando a modalidade permite cobrança)",
    )
    arpu_escolar_mensal: float = Field(
        1_200.0, gt=0,
        description="ARPU mensal por escola pública conectada (R$)",
    )
    num_escolas: int = Field(
        0, ge=0,
        description="Número de escolas públicas no município (para receita escolar)",
    )


class CapexResult(BaseModel):
    """Resultado do cálculo de CapEx, em R$ milhões."""

    acesso: float = Field(description="CapEx de rede de acesso (R$ mi)")
    backhaul: float = Field(description="CapEx de backhaul (R$ mi); 0 se comprometido")
    ativacao: float = Field(description="CapEx de ativação dos clientes (R$ mi)")
    total: float = Field(description="CapEx incremental total (R$ mi)")


class FinancialResult(BaseModel):
    """Business case completo de um município."""

    id_municipio: str
    capex: CapexResult
    receita_anual: float = Field(description="Receita anual em maturidade (R$ mi)")
    ebitda_anual: float = Field(description="EBITDA anual em maturidade (R$ mi)")
    payback_anos: float = Field(description="Payback simples (anos)")
    npv: float = Field(description="VPL do projeto (R$ mi)")
    sensitivity: list[dict] = Field(
        description="Tabela de sensibilidade: [{adesao_pct, payback_anos}, ...]"
    )
