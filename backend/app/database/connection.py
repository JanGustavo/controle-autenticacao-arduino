import os
from collections.abc import Generator
from contextlib import contextmanager

import psycopg


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL não configurada.")
    return database_url


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    with psycopg.connect(_database_url()) as connection:
        yield connection