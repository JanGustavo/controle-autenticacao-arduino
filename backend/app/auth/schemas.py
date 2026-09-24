from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "usuario": "admin@ardlock.local",
                "senha": "admin",
            }
        }
    )

    usuario: str = Field(description="E-mail/login do administrador")
    senha: str = Field(description="Senha do administrador")


class LoginResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sucesso": True,
                "token": "<jwt>",
                "usuario": "admin@ardlock.local",
                "token_type": "bearer",
                "expires_in": 3600,
                "mensagem": "Login realizado com sucesso.",
            }
        }
    )
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