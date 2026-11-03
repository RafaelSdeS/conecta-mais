"""Síntese técnica determinística derivada das funções atuais de scores."""

from __future__ import annotations

import ast
import inspect
import textwrap
from pathlib import Path
from typing import Callable

from conecta.agent.schemas import DocumentReference
from conecta.rag.catalog import REPOSITORY_ROOT
from conecta.scores import calculator
from conecta.scores.models import ScoreWeights


def _function_source(function: Callable) -> tuple[str, int]:
    lines, first_line = inspect.getsourcelines(function)
    return textwrap.dedent("".join(lines)), first_line


def _assignment(function: Callable, name: str) -> str:
    source, _ = _function_source(function)
    module = ast.parse(source)
    for node in ast.walk(module):
        if not isinstance(node, ast.Assign):
            continue
        if any(isinstance(target, ast.Name) and target.id == name for target in node.targets):
            segment = ast.get_source_segment(source, node)
            if segment is not None:
                return " ".join(segment.split())
    raise RuntimeError(f"A atribuição {name!r} não foi encontrada no código do motor.")


def _subscript_assignment(function: Callable, key: str) -> str:
    source, _ = _function_source(function)
    module = ast.parse(source)
    for node in ast.walk(module):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if (
                isinstance(target, ast.Subscript)
                and isinstance(target.slice, ast.Constant)
                and target.slice.value == key
            ):
                segment = ast.get_source_segment(source, node)
                if segment is not None:
                    return " ".join(segment.split())
    raise RuntimeError(f"A atribuição {key!r} não foi encontrada no código do motor.")


def _return_expression(function: Callable) -> str:
    source, _ = _function_source(function)
    module = ast.parse(source)
    returns = [node for node in ast.walk(module) if isinstance(node, ast.Return)]
    if not returns or returns[-1].value is None:
        raise RuntimeError("A expressão de retorno não foi encontrada no código do motor.")
    expression = ast.get_source_segment(source, returns[-1].value)
    if expression is None:
        raise RuntimeError("Não foi possível ler a expressão de retorno do motor.")
    return " ".join(expression.split())


def _reference(function: Callable, title: str, section: str) -> DocumentReference:
    _, first_line = _function_source(function)
    source_lines, _ = inspect.getsourcelines(function)
    source_path = Path(inspect.getsourcefile(function) or "").resolve()
    return DocumentReference(
        title=title,
        source_path=source_path.relative_to(REPOSITORY_ROOT).as_posix(),
        section=section,
        line_start=first_line,
        line_end=first_line + len(source_lines) - 1,
        document_type="implementation_code",
        is_official=False,
    )


def build_score_explanation() -> tuple[str, list[DocumentReference]]:
    defaults = {
        key: ScoreWeights.model_fields[key].default
        for key in ("w_M", "w_I", "w_C", "w_A")
    }

    minmax_source, _ = _function_source(calculator._minmax)
    minmax_body = [
        " ".join(line.strip().split())
        for line in minmax_source.splitlines()
        if line.strip().startswith("if hi == lo:") or "return pd.Series(50.0" in line
        or line.strip().startswith("return (series - lo)")
    ]
    minmax_summary = " ".join(minmax_body)

    market_formula = (
        _assignment(calculator._score_M, "raw")
        + "; return "
        + _return_expression(calculator._score_M)
    )
    impact_formula = (
        _assignment(calculator._score_I, "raw")
        + "; return "
        + _return_expression(calculator._score_I)
    )
    cost_assignments = [
        _assignment(calculator._score_C, name)
        for name in ("dist_km", "densidade", "custo_proxy", "score")
    ]
    leverage_assignments = [
        _assignment(calculator._score_A, name)
        for name in ("acordo", "fust", "eace", "raw")
    ]
    total_formula = _subscript_assignment(calculator.calculate_scores, "score_total")

    answer = "\n".join(
        (
            "Dimensões do motor:",
            "- M — Mercado (potencial de mercado; score_M).",
            "- I — Impacto educacional (score_I).",
            "- C — Custo estimado de implantação; o score é invertido: "
            "menor custo proxy resulta em score_C maior.",
            "- A — Alavancas financeiras e regulatórias (score_A).",
            "",
            "Normalização usada pelas parcelas min-max: " + minmax_summary,
            "",
            "Fórmulas das dimensões, conforme as expressões do código:",
            "- M: " + market_formula,
            "- I: " + impact_formula,
            "- C: " + "; ".join(cost_assignments),
            "- A: " + "; ".join(leverage_assignments),
            "",
            "Pesos padrão: "
            + ", ".join(f"{key}={value:.2f}" for key, value in defaults.items())
            + ". Os pesos configurados devem somar 1.",
            "Score total: " + total_formula,
            "Normalizações são relativas ao conjunto recebido. score_C não é CapEx; "
            "o campo demonstrativo FUST não comprova elegibilidade oficial.",
            "Fonte interna, não oficial: as referências abaixo apontam para o código do projeto.",
        )
    )

    references = [
        _reference(calculator._score_M, "Implementação dos scores", "_score_M"),
        _reference(calculator._score_I, "Implementação dos scores", "_score_I"),
        _reference(calculator._score_C, "Implementação dos scores", "_score_C"),
        _reference(calculator._score_A, "Implementação dos scores", "_score_A"),
        _reference(calculator.calculate_scores, "Implementação dos scores", "calculate_scores"),
        _reference(ScoreWeights, "Modelos de pesos dos scores", "ScoreWeights"),
    ]
    return answer, references
