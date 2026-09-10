from datetime import datetime

from pydantic import BaseModel, Field


class LocalCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=255)
    identificador_dispositivo: str = Field(min_length=1, max_length=100)
    ativo: bool = True


class LocalUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=255)
    identificador_dispositivo: str | None = Field(default=None, min_length=1, max_length=100)
    ativo: bool | None = None


class LocalResponse(BaseModel):
    local_id: int
    nome: str
    identificador_dispositivo: str
    ativo: bool
    criado_em: datetime
