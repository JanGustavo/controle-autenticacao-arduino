"""Small, per-administrator SQLite history for the AI page."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


def _database_path() -> Path:
    return Path(os.getenv("IA_SQLITE_PATH", "/app/data/ia.sqlite3"))


@contextmanager
def _connection():
    path = _database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path, timeout=5) as connection:
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ia_historico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER NOT NULL,
                pergunta TEXT NOT NULL,
                resposta TEXT NOT NULL,
                criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_ia_historico_admin ON ia_historico(admin_id, id DESC)"
        )
        yield connection


def listar_historico(admin_id: int) -> list[dict]:
    with _connection() as connection:
        rows = connection.execute(
            "SELECT id, pergunta, resposta, criado_em FROM ia_historico "
            "WHERE admin_id = ? ORDER BY id DESC LIMIT 30",
            (admin_id,),
        ).fetchall()
    return [
        {"id": row[0], "pergunta": row[1], "resposta": row[2], "criado_em": row[3]}
        for row in rows
    ]


def salvar_resposta(admin_id: int, pergunta: str, resposta: str) -> dict:
    with _connection() as connection:
        cursor = connection.execute(
            "INSERT INTO ia_historico(admin_id, pergunta, resposta) VALUES (?, ?, ?)",
            (admin_id, pergunta, resposta),
        )
        item_id = cursor.lastrowid
        connection.execute(
            "DELETE FROM ia_historico WHERE admin_id = ? AND id NOT IN "
            "(SELECT id FROM ia_historico WHERE admin_id = ? ORDER BY id DESC LIMIT 30)",
            (admin_id, admin_id),
        )
        row = connection.execute(
            "SELECT id, pergunta, resposta, criado_em FROM ia_historico WHERE id = ?",
            (item_id,),
        ).fetchone()
    return {"id": row[0], "pergunta": row[1], "resposta": row[2], "criado_em": row[3]}


def apagar_resposta(admin_id: int, item_id: int) -> bool:
    with _connection() as connection:
        cursor = connection.execute(
            "DELETE FROM ia_historico WHERE id = ? AND admin_id = ?",
            (item_id, admin_id),
        )
        return cursor.rowcount > 0
