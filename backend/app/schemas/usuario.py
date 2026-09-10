from datetime import datetime

from pydantic import BaseModel, Field


class PermissaoCreate(BaseModel):
    local_id: int
    horario_inicio: str
    horario_fim: str
    dias_semana: list[int]


class UsuarioCreate(BaseModel):
    nome: str
    uid_card: str | None = None
    vetor_facial: list[float] | None = None
    ativo: bool = True
    permissoes: list[PermissaoCreate] = Field(default_factory=list)


class UsuarioUpdate(BaseModel):
    nome: str | None = None
    uid_card: str | None = None
    vetor_facial: list[float] | None = None
    ativo: bool | None = None


class UsuarioResponse(BaseModel):
    user_id: int
    nome: str
    uid_card: str | None
    vetor_facial: list[float] | None
    ativo: bool
    criado_em: datetime