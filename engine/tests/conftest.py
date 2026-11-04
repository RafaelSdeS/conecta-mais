"""Os testes usam os dados demonstrativos, mesmo que exista um banco real em engine/data."""

import os

os.environ["CONECTA_SQLITE_PATH"] = os.path.join(os.path.dirname(__file__), "nao_existe.db")
os.environ["CONECTA_AUDIT_LOG"] = os.path.join(os.path.dirname(__file__), "auditoria_teste.jsonl")
