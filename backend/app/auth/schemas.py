from pydantic import BaseModel, EmailStr


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


class EsqueciSenhaRequest(BaseModel):
    email: EmailStr


class RedefinirSenhaRequest(BaseModel):
    token: str
    nova_senha: str