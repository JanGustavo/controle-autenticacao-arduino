from fastapi import HTTPException, status
from psycopg import OperationalError

from app.auth.schemas import LoginRequest, LoginResponse
from app.auth.security import (
    DUMMY_BCRYPT_HASH,
    criar_token_jwt,
    obter_expiracao_segundos,
    verificar_senha,
)
from app.database.connection import get_connection


def autenticar(credenciais: LoginRequest) -> LoginResponse:
    termo_busca = credenciais.usuario.strip()

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT admin_id, nome, email, senha_hash, ativo
                    FROM administrador
                    WHERE LOWER(email) = LOWER(%s)
                       OR (LOWER(email) = LOWER(%s || '@ardlock.local'))
                    """,
                    (termo_busca, termo_busca),
                )
                administrador = cursor.fetchone()
    except OperationalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível. Verifique o PostgreSQL local.",
        ) from error

    # Atenua timing attacks se o usuário não for encontrado
    if not administrador:
        verificar_senha(credenciais.senha, DUMMY_BCRYPT_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    admin_id, _nome, email, senha_hash, ativo = administrador
    senha_valida = verificar_senha(credenciais.senha, senha_hash)

    # Resposta genérica para não revelar se o usuário existe, está desativado ou errou a senha
    if not ativo or not senha_valida:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    token = criar_token_jwt(sub=str(admin_id), email=email)
    expires_in = obter_expiracao_segundos()

    return LoginResponse(
        sucesso=True,
        token=token,
        usuario=email,
        token_type="bearer",
        expires_in=expires_in,
    )