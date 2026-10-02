import os
from collections.abc import Generator
from contextlib import contextmanager

import psycopg

from app.utils.access_time import ACCESS_TIMEZONE


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL não configurada.")
    return database_url


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    with psycopg.connect(_database_url(), options=f"-c timezone={ACCESS_TIMEZONE}") as connection:
        yield connection