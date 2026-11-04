"""Os testes usam os dados demonstrativos, mesmo que exista um banco real em engine/data."""

import os

os.environ["CONECTA_SQLITE_PATH"] = os.path.join(os.path.dirname(__file__), "nao_existe.db")
os.environ["CONECTA_AUDIT_LOG"] = os.path.join(os.path.dirname(__file__), "auditoria_teste.jsonl")


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _sem_credenciais_do_dotenv(monkeypatch):
    """O load_dotenv de api.main lê engine/.env; os testes não podem depender dele."""
    for nome in ("WATSONX_APIKEY", "WATSONX_PROJECT_ID", "WATSONX_URL", "WATSONX_MODEL_ID", "WATSONX_MAX_TOKENS"):
        monkeypatch.delenv(nome, raising=False)
