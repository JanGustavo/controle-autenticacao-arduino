from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class AdministradorCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    senha: str = Field(min_length=6, max_length=128)
    ativo: bool = True
    foto_url: str | None = None


class AdministradorUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=255)
    email: str | None = Field(default=None, min_length=5, max_length=255)
    senha: str | None = Field(default=None, min_length=6, max_length=128)
    ativo: bool | None = None
    foto_url: str | None = None


class AdministradorResponse(BaseModel):
    admin_id: int
    nome: str
    email: str
    ativo: bool
    principal: bool
    foto_url: str | None = None
    criado_em: datetime

