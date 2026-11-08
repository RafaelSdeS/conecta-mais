"""Limite de chamadas de IA do protótipo público."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api import limite


def _req(ip="1.2.3.4", method="POST", encaminhado=None):
    headers = {"x-forwarded-for": encaminhado} if encaminhado else {}
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=ip), method=method)


@pytest.fixture(autouse=True)
def _limpa():
    limite._por_ip.clear()
    limite._global.clear()


def test_sem_variavel_nao_limita(monkeypatch):
    monkeypatch.delenv("CONECTA_IA_LIMITE_IP", raising=False)
    for _ in range(50):
        limite.limitar_ia(_req())


def test_terceira_chamada_do_mesmo_ip_recebe_429(monkeypatch):
    monkeypatch.setenv("CONECTA_IA_LIMITE_IP", "2")
    limite.limitar_ia(_req())
    limite.limitar_ia(_req())
    with pytest.raises(HTTPException) as erro:
        limite.limitar_ia(_req())
    assert erro.value.status_code == 429
    limite.limitar_ia(_req(ip="5.6.7.8"))  # outro IP não é afetado
    limite.limitar_ia(_req(method="GET"))  # leitura não conta


def test_limite_global_vale_para_ips_diferentes(monkeypatch):
    monkeypatch.setenv("CONECTA_IA_LIMITE_IP", "5")
    monkeypatch.setenv("CONECTA_IA_LIMITE_GLOBAL", "2")
    limite.limitar_ia(_req(ip="1.1.1.1"))
    limite.limitar_ia(_req(ip="2.2.2.2"))
    with pytest.raises(HTTPException) as erro:
        limite.limitar_ia(_req(ip="3.3.3.3"))
    assert erro.value.status_code == 429


def test_ip_vem_do_ultimo_valor_do_x_forwarded_for(monkeypatch):
    monkeypatch.setenv("CONECTA_IA_LIMITE_IP", "1")
    limite.limitar_ia(_req(encaminhado="9.9.9.9, 7.7.7.7"))
    with pytest.raises(HTTPException):  # o prefixo forjado muda, o IP real (último) não
        limite.limitar_ia(_req(encaminhado="8.8.8.8, 7.7.7.7"))
