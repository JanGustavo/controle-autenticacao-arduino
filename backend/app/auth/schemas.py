from pydantic import BaseModel


class LoginRequest(BaseModel):
    usuario: str
    senha: str


class LoginResponse(BaseModel):
    sucesso: bool
    token: str
    usuario: str