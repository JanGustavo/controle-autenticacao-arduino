from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.permissao_schema import PermissaoVinculoCreate


class UsuarioCreate(BaseModel):
    nome: str
    uid_card: str | None = None
    vetor_facial: list[float] | None = None
    ativo: bool = True
    permissoes: list[PermissaoVinculoCreate] = Field(default_factory=list)


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