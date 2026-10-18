import os
from unittest.mock import MagicMock

import psycopg
import pytest

from app.database import connection as database


def test_lifespan_pool_reuses_connections_and_closes(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://db/test")
    monkeypatch.setenv("DB_POOL_MIN_SIZE", "2")
    monkeypatch.setenv("DB_POOL_MAX_SIZE", "5")
    monkeypatch.setattr(database, "_pool", None)

    pool = MagicMock()
    pool.connection.return_value.__enter__.return_value = pool.connection_object
    factory = MagicMock(return_value=pool)
    monkeypatch.setattr(database, "ConnectionPool", factory)
    direct_connect = MagicMock()
    monkeypatch.setattr(database.psycopg, "connect", direct_connect)

    database.open_pool()
    try:
        factory.assert_called_once_with(
            conninfo="postgresql://db/test",
            min_size=2,
            max_size=5,
            kwargs={"options": "-c timezone=America/Sao_Paulo"},
            open=False,
        )
        pool.open.assert_called_once()
        pool.wait.assert_called_once()
        with database.get_connection() as connection:
            assert connection is pool.connection_object
        pool.connection.assert_called_once()
        direct_connect.assert_not_called()
    finally:
        database.close_pool()

    pool.close.assert_called_once()
    assert database._pool is None


def test_get_connection_sem_lifespan_preserva_conexao_direta(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://db/test")
    monkeypatch.setattr(database, "_pool", None)
    direct_connect = MagicMock()
    monkeypatch.setattr(database.psycopg, "connect", direct_connect)

    with database.get_connection() as connection:
        assert connection is direct_connect.return_value.__enter__.return_value

    direct_connect.assert_called_once_with(
        "postgresql://db/test", options="-c timezone=America/Sao_Paulo"
    )


def test_falha_ao_abrir_pool_fecha_recursos(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://db/test")
    monkeypatch.setattr(database, "_pool", None)
    pool = MagicMock()
    pool.wait.side_effect = RuntimeError("PostgreSQL indisponível")
    monkeypatch.setattr(database, "ConnectionPool", MagicMock(return_value=pool))

    with pytest.raises(RuntimeError, match="PostgreSQL indisponível"):
        database.open_pool()

    pool.close.assert_called_once()
    assert database._pool is None


def test_limites_invalidos_nao_abrem_pool(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://db/test")
    monkeypatch.setenv("DB_POOL_MIN_SIZE", "6")
    monkeypatch.setenv("DB_POOL_MAX_SIZE", "5")
    monkeypatch.setattr(database, "_pool", None)
    factory = MagicMock()
    monkeypatch.setattr(database, "ConnectionPool", factory)

    with pytest.raises(RuntimeError, match="não pode exceder"):
        database.open_pool()

    factory.assert_not_called()


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="PostgreSQL não configurado")
def test_pool_real_reutiliza_conexoes_e_recupera_transacao():
    database.open_pool()
    try:
        with database.get_connection() as first, database.get_connection() as second:
            first_pid = first.execute("SELECT pg_backend_pid()").fetchone()[0]
            second_pid = second.execute("SELECT pg_backend_pid()").fetchone()[0]
            assert first_pid != second_pid
            assert first.execute("SHOW timezone").fetchone()[0] == "America/Sao_Paulo"
            assert second.execute("SELECT 1").fetchone()[0] == 1

        with pytest.raises(psycopg.errors.DivisionByZero):
            with database.get_connection() as connection:
                connection.execute("SELECT 1 / 0")

        with database.get_connection() as connection:
            assert connection.execute("SELECT 1").fetchone()[0] == 1
    finally:
        database.close_pool()
