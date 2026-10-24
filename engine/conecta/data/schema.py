"""
Modelos Pydantic que definem o contrato de dados do Conecta+.

Estes schemas são a interface entre o pipeline do Joel (ETL) e os
módulos de cálculo do Rafael. Quando a base real chegar, o loader
valida contra estes modelos e falha explicitamente se algum campo
obrigatório estiver faltando ou com tipo errado.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class Municipio(BaseModel):
    """Representa um município com todos os campos necessários para os cálculos."""

    # --- Identificação ---
    id_municipio: str = Field(..., description="Código IBGE de 7 dígitos")
    nome: str
    uf: str = Field(..., min_length=2, max_length=2)
    lat: float = Field(..., ge=-34.0, le=5.5)
    lon: float = Field(..., ge=-74.0, le=-28.0)

    # --- Potencial de Mercado (score M) ---
    domicilios_urbanos: int = Field(..., ge=0)
    renda_media: float = Field(..., ge=0.0, description="Renda domiciliar média (R$)")
    acessos_fibra: int = Field(..., ge=0, description="Acessos de fibra óptica (Anatel)")
    acessos_total_bl: int = Field(..., ge=0, description="Total de acessos de banda larga fixa")
    market_share_vivo_movel: float = Field(..., ge=0.0, le=1.0, description="Share móvel da Vivo no município")
    hhi: float = Field(..., ge=0.0, le=10000.0, description="Índice Herfindahl-Hirschman de banda larga fixa")

    # --- Impacto Educacional (score I) ---
    matriculas_publicas: int = Field(..., ge=0)
    matriculas_rurais_pct: float = Field(..., ge=0.0, le=1.0, description="Percentual de matrículas rurais")
    velocidade_medida_mbps: float = Field(..., ge=0.0, description="Velocidade medida (Medidor NIC.br); 0 = sem medição")
    alunos_maior_turno_est: int = Field(..., ge=0, description="Estimativa de alunos no maior turno")
    escolas_sem_internet_aprendizagem: int = Field(..., ge=0)
    ivs: float = Field(..., ge=0.0, le=1.0, description="Índice de Vulnerabilidade Social (IPEA)")

    # --- Custo de Implantação (score C) ---
    # dist_backhaul_km é calculado pelo módulo geo — não vem do CSV diretamente
    dist_backhaul_km: Optional[float] = Field(None, ge=0.0)

    # --- Alavancas (score A) ---
    tem_backhaul_fibra: bool = Field(..., description="Município já possui backhaul de fibra")
    acordo_migracao: bool = Field(..., description="Incluído no acordo de migração da concessão Vivo/Anatel")
    ano_backhaul: Optional[int] = Field(None, description="Ano previsto de entrega do backhaul do acordo")
    fust_elegivel: bool = Field(..., description="Elegível a alguma modalidade do FUST")
    eace_escolas: int = Field(..., ge=0, description="Escolas cobertas pelo EACE/Aprender Conectado")

    @field_validator("id_municipio")
    @classmethod
    def validar_id_ibge(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 7:
            raise ValueError(f"id_municipio deve ter 7 dígitos numéricos, recebido: {v!r}")
        return v

    @field_validator("uf")
    @classmethod
    def validar_uf(cls, v: str) -> str:
        ufs_validas = {
            "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
            "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
            "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
        }
        v = v.upper()
        if v not in ufs_validas:
            raise ValueError(f"UF inválida: {v!r}")
        return v
