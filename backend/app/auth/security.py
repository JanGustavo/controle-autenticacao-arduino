import os
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

# Hash bcrypt dummy pré-calculado e válido para mitigar timing attacks contra enumeração de e-mail
DUMMY_BCRYPT_HASH = "$2b$12$aINBb4hKDDfrK3FBd1CpIul9Q3LrB9aT5vceZUbsVBQF8I/aKKlA6"


def gerar_hash_senha(senha: str) -> str:
    """Gera hash seguro de senha utilizando bcrypt com salt aleatório.
    
    O hash gerado é irreversível e nunca deve ser descriptografado.
    """
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(senha.encode("utf-8"), salt).decode("utf-8")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Verifica se a senha em texto puro corresponde ao hash bcrypt armazenado.
    
    Retorna False em caso de formato inválido ou falha de correspondência.
    """
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _obter_config_jwt() -> tuple[str, str, int]:
    """Obtém configurações de JWT a partir das variáveis de ambiente."""
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("Variável de ambiente JWT_SECRET não configurada.")

    algorithm = os.getenv("JWT_ALGORITHM", "HS256")
    try:
        expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    except (ValueError, TypeError):
        expire_minutes = 60

    return secret, algorithm, expire_minutes


def obter_expiracao_segundos(expires_delta: timedelta | None = None) -> int:
    """Retorna o tempo de expiração configurado para o token em segundos."""
    _, _, default_expire_minutes = _obter_config_jwt()
    delta = expires_delta if expires_delta is not None else timedelta(minutes=default_expire_minutes)
    return int(delta.total_seconds())


def criar_token_jwt(
    sub: str | int,
    email: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Gera um JSON Web Token (JWT) assinado com as claims obrigatórias (sub, email, iat, exp)."""
    secret, algorithm, default_expire_minutes = _obter_config_jwt()

    agora = datetime.now(timezone.utc)
    delta = expires_delta if expires_delta is not None else timedelta(minutes=default_expire_minutes)
    expiracao = agora + delta

    payload: dict[str, Any] = {
        "sub": str(sub),
        "email": email,
        "iat": int(agora.timestamp()),
        "exp": int(expiracao.timestamp()),
    }

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, secret, algorithm=algorithm)


def validar_token_jwt(token: str) -> dict[str, Any]:
    """Valida a assinatura, formato e expiração de um JWT.
    
    Levanta jwt.ExpiredSignatureError caso o token esteja expirado,
    e jwt.InvalidTokenError em caso de token inválido ou adulterado.
    """
    secret, algorithm, _ = _obter_config_jwt()

    token_limpo = token.strip()
    if token_limpo.lower().startswith("bearer "):
        token_limpo = token_limpo[7:].strip()

    return jwt.decode(token_limpo, secret, algorithms=[algorithm])
