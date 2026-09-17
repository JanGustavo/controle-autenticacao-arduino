from fastapi import APIRouter

from app.auth.schemas import (
    EsqueciSenhaRequest,
    LoginRequest,
    LoginResponse,
    RedefinirSenhaRequest,
)
from app.auth.service import autenticar, redefinir_senha, solicitar_reset_senha

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(credenciais: LoginRequest) -> LoginResponse:
    return autenticar(credenciais)


@router.post("/forgot-password")
async def esqueci_senha(dados: EsqueciSenhaRequest) -> dict:
    return await solicitar_reset_senha(dados)


@router.post("/reset-password")
def resetar_senha(dados: RedefinirSenhaRequest) -> dict:
    return redefinir_senha(dados)