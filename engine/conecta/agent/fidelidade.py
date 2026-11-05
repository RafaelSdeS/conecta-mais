"""Confere se os números de um texto gerado pelo Granite existem nos dados entregues a ele (§9 da proposta)."""

from __future__ import annotations

import re
from collections.abc import Iterator
from numbers import Real
from typing import Any

# 12.345,67 | 12 345 | 12,5 | 12.5 | 1234. Não pega número colado em letra (Q1, M2) nem pedaço de outro número.
_NUMERO = re.compile(r"(?<![\w.,])(?:\d{1,3}(?:[. \u00a0\u202f]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)(?!\w)")
_ESPACOS = re.compile(r"[ \u00a0\u202f]")
_SO_MILHAR = re.compile(r"\d{1,3}(?:\.\d{3})+")
_ESCALAS = (1.0, 100.0, 1e-3, 1e-6, 1e-9)  # valor cru, fração em %, mil, milhão, bilhão


def _numeros(texto: str) -> Iterator[tuple[str, float, int]]:
    """Cada número do texto: como foi escrito, valor e casas decimais escritas."""
    for literal in _NUMERO.findall(texto):
        normal = _ESPACOS.sub("", literal)
        if "," in normal:
            normal = normal.replace(".", "").replace(",", ".")
        elif _SO_MILHAR.fullmatch(normal):
            normal = normal.replace(".", "")
        yield literal, float(normal), len(normal.partition(".")[2])


def _valores(dados: Any) -> Iterator[float]:
    if isinstance(dados, bool) or dados is None:
        return
    if isinstance(dados, Real):
        yield abs(float(dados))  # o texto costuma escrever "VPL negativo de R$ 592 mi" sem o sinal no número
    elif isinstance(dados, str):
        yield from (valor for _, valor, _ in _numeros(dados))
    elif isinstance(dados, dict):
        for item in dados.values():
            yield from _valores(item)
    elif isinstance(dados, (list, tuple)):
        for item in dados:
            yield from _valores(item)


def numeros_nao_confirmados(texto: str, dados: Any) -> list[str]:
    """Números do texto sem correspondente em `dados`, como foram escritos e sem repetição."""
    valores = set(_valores(dados))
    faltando = []
    for literal, numero, casas in _numeros(texto):
        if casas == 0 and (numero <= 10 or numero == 100 or 1900 <= numero <= 2100):
            continue  # contagens da prosa ("os 3 melhores"), a escala de 0 a 100 e anos
        folga = 0.5 * 10**-casas + 1e-9  # tolera o arredondamento que o texto escreveu
        # ponytail: compara valor, não significado ("R$ 45" confere com 45 escolas); cruzar unidade se isso enganar
        if not any(abs(valor * escala - numero) <= folga for valor in valores for escala in _ESCALAS):
            faltando.append(literal)
    return list(dict.fromkeys(faltando))
