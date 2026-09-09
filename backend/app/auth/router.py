from fastapi import APIRouter

from app.auth.schemas import LoginRequest, LoginResponse
from app.auth.service import autenticar

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(credenciais: LoginRequest) -> LoginResponse:
    return autenticar(credenciais)