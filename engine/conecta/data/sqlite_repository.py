"""Consultas somente leitura ao SQLite integrado do Conecta+."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


class SQLiteDataUnavailable(RuntimeError):
    """O banco integrado não está configurado ou não pode ser consultado."""


class SQLiteDataRepository:
    def __init__(self, path: str | Path | None = None):
        self._path = Path(path).expanduser() if path is not None else None

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        configured_path = self._path
        if configured_path is None:
            environment_path = os.getenv("CONECTA_SQLITE_PATH")
            if not environment_path:
                raise SQLiteDataUnavailable(
                    "SQLite integrado não configurado. Defina CONECTA_SQLITE_PATH."
                )
            configured_path = Path(environment_path).expanduser()

        if not configured_path.is_file():
            raise SQLiteDataUnavailable(
                "Banco SQLite integrado não encontrado ou não é um arquivo."
            )

        try:
            connection = sqlite3.connect(
                f"{configured_path.resolve().as_uri()}?mode=ro",
                uri=True,
            )
        except sqlite3.Error as exc:
            raise SQLiteDataUnavailable(
                "Não foi possível abrir o SQLite integrado em modo somente leitura."
            ) from exc

        connection.row_factory = sqlite3.Row
        try:
            yield connection
        except sqlite3.Error as exc:
            raise SQLiteDataUnavailable(
                "Não foi possível consultar o SQLite integrado. "
                "Verifique se o banco contém as tabelas e colunas esperadas."
            ) from exc
        finally:
            connection.close()

    def list_municipios(
        self,
        nome: str | None,
        uf: str | None,
        limite: int,
        offset: int,
    ) -> tuple[int, list[dict]]:
        filters: list[str] = []
        parameters: list[object] = []
        if nome:
            filters.append("municipio LIKE ?")
            parameters.append(f"%{nome}%")
        if uf:
            filters.append("UPPER(uf) = ?")
            parameters.append(uf.upper())

        where = f" WHERE {' AND '.join(filters)}" if filters else ""
        with self._connection() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM municipios{where}", parameters
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT * FROM municipios{where} "
                "ORDER BY municipio LIMIT ? OFFSET ?",
                [*parameters, limite, offset],
            ).fetchall()
        return total, [dict(row) for row in rows]

    def get_municipio(self, codigo_ibge: str) -> dict | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM municipios WHERE codigo_ibge = ?",
                (codigo_ibge,),
            ).fetchone()
        return dict(row) if row is not None else None

    def list_escolas(
        self,
        codigo_municipio: str | None,
        codigo_escola: str | None,
        limite: int,
        offset: int,
    ) -> tuple[int, list[dict]]:
        filters: list[str] = []
        parameters: list[str] = []
        if codigo_municipio:
            filters.append("e.CO_MUNICIPIO = ?")
            parameters.append(codigo_municipio)
        if codigo_escola:
            filters.append("e.CO_ENTIDADE = ?")
            parameters.append(codigo_escola)

        where = f" WHERE {' AND '.join(filters)}" if filters else ""
        with self._connection() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM escolas AS e{where}", parameters
            ).fetchone()[0]
            rows = connection.execute(
                "SELECT e.*, v.status_localizacao "
                "FROM escolas AS e "
                "LEFT JOIN validacao_localizacao AS v "
                "ON e.CO_ENTIDADE = v.CO_ENTIDADE"
                f"{where} ORDER BY e.CO_ENTIDADE LIMIT ? OFFSET ?",
                [*parameters, limite, offset],
            ).fetchall()
        return total, [dict(row) for row in rows]

    def list_escolas_visita(self, codigo_municipio: str, limite: int) -> tuple[int, list[dict]]:
        """
        Escolas sem internet para aprendizagem, por número de alunos, com endereço e telefone.

        Só a tela de visita usa este método: o telefone pode ser pessoal e não deve ir para o modelo de IA.
        """
        with self._connection() as connection:
            total = connection.execute(
                "SELECT COUNT(*) FROM escolas_visita WHERE id_municipio = ?", (codigo_municipio,)
            ).fetchone()[0]
            rows = connection.execute(
                "SELECT codigo_inep, escola, rede, zona, alunos, endereco, telefone FROM escolas_visita "
                "WHERE id_municipio = ? ORDER BY alunos DESC, escola LIMIT ?",
                (codigo_municipio, limite),
            ).fetchall()
        return total, [dict(row) for row in rows]

    def list_ubs(self, codigo_municipio: str, limite: int, offset: int) -> tuple[int, list[dict]]:
        """UBS habilitadas do município (tabela ubs, vinda do CNES)."""
        with self._connection() as connection:
            total = connection.execute(
                "SELECT COUNT(*) FROM ubs WHERE id_municipio = ?", (codigo_municipio,)
            ).fetchone()[0]
            rows = connection.execute(
                "SELECT codigo_cnes, nome, lat, lon FROM ubs WHERE id_municipio = ? "
                "ORDER BY nome LIMIT ? OFFSET ?",
                (codigo_municipio, limite, offset),
            ).fetchall()
        return total, [dict(row) for row in rows]

    def list_provedores(self, codigo_municipio: str) -> list[dict]:
        """Provedores de banda larga fixa do município, do maior para o menor em acessos."""
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT empresa, cnpj, grupo, porte, acessos, acessos_fibra FROM provedores "
                "WHERE id_municipio = ? ORDER BY acessos DESC",
                (codigo_municipio,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_indicadores(self, codigo_ibge: str) -> dict | None:
        with self._connection() as connection:
            row = connection.execute(
                """
                SELECT
                    codigo_ibge,
                    municipio,
                    uf,
                    total_escolas,
                    escolas_sem_internet,
                    escolas_sem_banda_larga,
                    escolas_com_medicao,
                    velocidade_media_escolas_mbps,
                    total_acessos,
                    acessos_ftth
                FROM municipios
                WHERE codigo_ibge = ?
                """,
                (codigo_ibge,),
            ).fetchone()
            if row is None:
                return None

            location_rows = connection.execute(
                """
                SELECT v.status_localizacao, COUNT(*) AS quantidade
                FROM escolas AS e
                JOIN validacao_localizacao AS v
                    ON e.CO_ENTIDADE = v.CO_ENTIDADE
                WHERE e.CO_MUNICIPIO = ?
                GROUP BY v.status_localizacao
                """,
                (codigo_ibge,),
            ).fetchall()

        return {
            "municipio": dict(row),
            "validacao_geografica": {
                item["status_localizacao"]: item["quantidade"]
                for item in location_rows
            },
        }

    def list_escolas_sem_internet(
        self,
        codigo_municipio: str,
        limite: int,
        offset: int,
    ) -> tuple[dict | None, int, list[dict]]:
        with self._connection() as connection:
            municipality_row = connection.execute(
                """
                SELECT codigo_ibge, municipio, uf
                FROM municipios
                WHERE codigo_ibge = ?
                """,
                (codigo_municipio,),
            ).fetchone()
            if municipality_row is None:
                return None, 0, []

            total = connection.execute(
                """
                SELECT COUNT(*)
                FROM escolas
                WHERE CO_MUNICIPIO = ? AND IN_INTERNET = 0
                """,
                (codigo_municipio,),
            ).fetchone()[0]
            rows = connection.execute(
                """
                SELECT
                    e.CO_ENTIDADE AS codigo_inep,
                    e.NO_ENTIDADE AS escola,
                    e.NO_MUNICIPIO AS municipio,
                    e.SG_UF AS uf,
                    e.IN_INTERNET AS possui_internet,
                    e.latitude,
                    e.longitude,
                    v.status_localizacao
                FROM escolas AS e
                LEFT JOIN validacao_localizacao AS v
                    ON e.CO_ENTIDADE = v.CO_ENTIDADE
                WHERE e.CO_MUNICIPIO = ? AND e.IN_INTERNET = 0
                ORDER BY e.NO_ENTIDADE
                LIMIT ? OFFSET ?
                """,
                (codigo_municipio, limite, offset),
            ).fetchall()

        return (
            dict(municipality_row),
            total,
            [dict(row) for row in rows],
        )
