from fastapi import APIRouter, Request

from app.auth.schemas import (
    EsqueciSenhaRequest,
    LoginRequest,
    LoginResponse,
    RedefinirSenhaRequest,
)
from app.auth.service import autenticar, redefinir_senha, solicitar_reset_senha

router = APIRouter()


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Autenticar administrador",
    response_description="JWT administrativo e dados básicos da sessão",
    responses={
        401: {"description": "Credenciais inválidas ou administrador inativo"},
        422: {"description": "Payload inválido"},
    },
)
def login(credenciais: LoginRequest, request: Request) -> LoginResponse:
    return autenticar(credenciais, request)


@router.post(
    "/forgot-password",
    summary="Solicitar recuperação de senha",
    responses={422: {"description": "E-mail inválido"}},
)
async def esqueci_senha(dados: EsqueciSenhaRequest, request: Request) -> dict:
    return await solicitar_reset_senha(dados, request)


@router.post(
    "/reset-password",
    summary="Redefinir senha com token de recuperação",
    responses={
        400: {"description": "Token inválido ou expirado"},
        422: {"description": "Payload inválido"},
    },
)
def resetar_senha(dados: RedefinirSenhaRequest, request: Request) -> dict:
    return redefinir_senha(dados, request)