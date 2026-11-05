"""Verificação de fidelidade: números do texto gerado contra os dados entregues ao modelo."""

from __future__ import annotations

from conecta.agent.fidelidade import numeros_nao_confirmados

DADOS = {
    "capex": 3234567.8,
    "payback": 6.52,
    "share": 0.446,
    "alunos": 12345,
    "fonte": "INEP com 1.200 escolas",
    "por_uf": {"BA": 27},
    "lista": [{"vpl": -1500000.0}],
    "ativo": True,
}


def test_numero_inventado_e_apontado_uma_vez():
    assert numeros_nao_confirmados("VPL de R$ 9,9 milhões, repito: 9,9.", DADOS) == ["9,9"]


def test_arredondamentos_e_escalas_conferem():
    texto = (
        "CapEx de R$ 3,2 milhões (R$ 3.235 mil), payback de 6,5 anos, share de 45%, "
        "12.345 alunos, 1.200 escolas e 27 municípios."
    )
    assert numeros_nao_confirmados(texto, DADOS) == []


def test_arredondamento_alem_do_escrito_nao_confere():
    assert numeros_nao_confirmados("payback de 6,50 anos", {"payback": 6.52}) == ["6,50"]


def test_ignora_siglas_anos_e_contagens_da_prosa():
    assert numeros_nao_confirmados("Os 3 melhores do Q1 em 2024, na escala de 0 a 100.", DADOS) == []


def test_booleano_nao_vira_numero():
    assert numeros_nao_confirmados("Foram 1,0 ponto.", {"ativo": True}) == ["1,0"]
