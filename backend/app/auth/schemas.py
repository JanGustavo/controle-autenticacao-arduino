from pydantic import BaseModel


class LoginRequest(BaseModel):
    usuario: str
    senha: str


class LoginResponse(BaseModel):
    sucesso: bool
    token: str
    usuario: str
    token_type: str = "bearer"
    expires_in: int
    mensagem: str | None = None