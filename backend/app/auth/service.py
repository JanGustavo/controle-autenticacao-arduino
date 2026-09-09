import secrets

from fastapi import HTTPException, status

from app.auth.schemas import LoginRequest, LoginResponse


def autenticar(credenciais: LoginRequest) -> LoginResponse:
    """Autenticacao temporaria do MVP, sem dependencia do banco de dados."""
    if credenciais.usuario != "admin" or credenciais.senha != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    return LoginResponse(
        sucesso=True,
        token=secrets.token_urlsafe(32),
        usuario=credenciais.usuario,
    )