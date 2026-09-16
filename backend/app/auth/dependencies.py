from typing import Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from psycopg import OperationalError

from app.auth.security import validar_token_jwt
from app.database.connection import get_connection

security_scheme = HTTPBearer(auto_error=False)


def obter_administrador_atual(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
) -> dict[str, Any]:
    """Dependência central do FastAPI para autenticar administradores via Bearer JWT.

    1. Verifica presença do header Authorization / esquema Bearer.
    2. Valida token JWT (formato, assinatura, expiração).
    3. Exige claim `sub` (admin_id).
    4. Consulta banco de dados para verificar se o admin ainda existe e se ativo == True.
    """
    headers = {"WWW-Authenticate": "Bearer"}

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação não fornecido.",
            headers=headers,
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Esquema de autenticação inválido. Use Bearer.",
            headers=headers,
        )

    token = credentials.credentials

    try:
        payload = validar_token_jwt(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado.",
            headers=headers,
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou malformado.",
            headers=headers,
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificação do administrador.",
            headers=headers,
        )

    try:
        admin_id = int(sub)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificação do administrador inválida no token.",
            headers=headers,
        )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT admin_id, nome, email, ativo
                    FROM administrador
                    WHERE admin_id = %s
                    """,
                    (admin_id,),
                )
                admin = cursor.fetchone()
    except OperationalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível.",
        ) from error

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrador não encontrado.",
            headers=headers,
        )

    id_db = admin[0]
    nome_db = admin[1]
    email_db = admin[2]
    # Se a consulta selecionar 4 colunas (id, nome, email, ativo) ativo é o index 3; se selecionar 5 (id, nome, email, senha_hash, ativo), é o index 4
    ativo_db = admin[-1]

    if not ativo_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrador desativado.",
            headers=headers,
        )

    return {
        "admin_id": id_db,
        "nome": nome_db,
        "email": email_db,
        "ativo": ativo_db,
    }

