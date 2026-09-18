import os
from unittest.mock import MagicMock
import pytest

os.environ.setdefault("JWT_SECRET", "super_secret_test_jwt_key_2026_at_least_32_chars_long")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")


@pytest.fixture(autouse=True)
def bypass_auth_db_lookup(monkeypatch):
    """Bypasses database checks for admin auth dependency and login service across test runs by default,

    allowing endpoints to validate auth without requiring a live PostgreSQL connection.
    Tests in test_bearer_auth test both valid and invalid DB states explicitly.
    """
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    # Tupla correspondente a SELECT admin_id, nome, email, senha_hash, ativo, foto_url
    mock_cursor.fetchone.return_value = (
        1,
        "Admin Teste",
        "admin@ardlock.local",
        "$2b$12$aINBb4hKDDfrK3FBd1CpIul9Q3LrB9aT5vceZUbsVBQF8I/aKKlA6",
        True,
        None,
    )
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    class MockContextManager:
        def __enter__(self):
            return mock_conn
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    def mock_get_connection():
        return MockContextManager()

    # Moca a conexão do banco usada pelo service de login e pela dependência de auth
    monkeypatch.setattr("app.auth.service.get_connection", mock_get_connection)
    monkeypatch.setattr("app.auth.dependencies.get_connection", mock_get_connection)

