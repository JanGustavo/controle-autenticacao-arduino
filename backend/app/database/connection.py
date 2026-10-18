import os
from collections.abc import Generator
from contextlib import contextmanager

import psycopg
from psycopg_pool import ConnectionPool

from app.utils.access_time import ACCESS_TIMEZONE


_pool: ConnectionPool | None = None


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL não configurada.")
    return database_url


def _pool_size(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as error:
        raise RuntimeError(f"{name} deve ser um número inteiro.") from error
    if value < 1:
        raise RuntimeError(f"{name} deve ser maior que zero.")
    return value


def open_pool() -> None:
    """Abre a pool no startup; cada processo do backend possui a sua."""
    global _pool
    if _pool is not None:
        raise RuntimeError("Pool de conexões já inicializada.")

    min_size = _pool_size("DB_POOL_MIN_SIZE", 2)
    max_size = _pool_size("DB_POOL_MAX_SIZE", 5)
    if min_size > max_size:
        raise RuntimeError("DB_POOL_MIN_SIZE não pode exceder DB_POOL_MAX_SIZE.")

    pool = ConnectionPool(
        conninfo=_database_url(),
        min_size=min_size,
        max_size=max_size,
        kwargs={"options": f"-c timezone={ACCESS_TIMEZONE}"},
        open=False,
    )
    try:
        pool.open()
        pool.wait()
    except Exception:
        pool.close()
        raise
    _pool = pool


def close_pool() -> None:
    """Fecha a pool depois que as tarefas de background terminarem."""
    global _pool
    pool, _pool = _pool, None
    if pool is not None:
        pool.close()


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    # Scripts e TestClient sem lifespan continuam com o comportamento anterior.
    pool = _pool
    if pool is None:
        context = psycopg.connect(
            _database_url(), options=f"-c timezone={ACCESS_TIMEZONE}"
        )
    else:
        context = pool.connection()
    with context as connection:
        yield connection
