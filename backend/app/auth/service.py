import hashlib
import hmac
import secrets

from fastapi import HTTPException, status
from psycopg import OperationalError

from app.auth.schemas import LoginRequest, LoginResponse
from app.database.connection import get_connection


def _senha_confere(senha: str, senha_hash: str) -> bool:
    """Valida hashes no formato pbkdf2_sha256$iteracoes$salt$hash."""
    try:
        algoritmo, iteracoes, salt, digest = senha_hash.split("$", 3)
        if algoritmo != "pbkdf2_sha256":
            return False
        esperado = hashlib.pbkdf2_hmac(
            "sha256",
            senha.encode("utf-8"),
            salt.encode("utf-8"),
            int(iteracoes),
        ).hex()
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(esperado, digest)


def autenticar(credenciais: LoginRequest) -> LoginResponse:
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT admin_id, nome, email, senha_hash
                    FROM administrador
                    WHERE LOWER(email) = LOWER(%s) AND ativo = TRUE
                    """,
                    (credenciais.usuario.strip(),),
                )
                administrador = cursor.fetchone()
    except OperationalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível. Verifique o PostgreSQL local.",
        ) from error

    if not administrador or not _senha_confere(credenciais.senha, administrador[3]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    return LoginResponse(
        sucesso=True,
        token=secrets.token_urlsafe(32),
        usuario=administrador[2],
    )