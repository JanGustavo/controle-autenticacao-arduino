from fastapi import APIRouter, Request

from app.auth.schemas import (
    EsqueciSenhaRequest,
    LoginRequest,
    LoginResponse,
    RedefinirSenhaRequest,
)
from app.auth.service import autenticar, redefinir_senha, solicitar_reset_senha

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(credenciais: LoginRequest, request: Request) -> LoginResponse:
    return autenticar(credenciais, request)


@router.post("/forgot-password")
async def esqueci_senha(dados: EsqueciSenhaRequest, request: Request) -> dict:
    return await solicitar_reset_senha(dados, request)


@router.post("/reset-password")
def resetar_senha(dados: RedefinirSenhaRequest, request: Request) -> dict:
    return redefinir_senha(dados, request)