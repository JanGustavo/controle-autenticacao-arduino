from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.permissao_schema import PermissaoVinculoCreate


TipoUsuario = Literal["INTERNO", "VISITANTE"]


class UsuarioCreate(BaseModel):
    nome: str
    cpf: str | None = Field(default=None, max_length=14)
    tipo_usuario: TipoUsuario = "INTERNO"
    uid_card: str | None = None
    vetor_facial: list[float] | None = None
    ativo: bool = True
    permissoes: list[PermissaoVinculoCreate] = Field(default_factory=list)


class UsuarioUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    """
    Edição dos dados cadastrais do usuário.

    RFID e biometria possuem endpoints próprios para preservar validações,
    auditoria e o contrato com o hardware.
    """

    nome: str | None = Field(default=None, min_length=2, max_length=255)
    cpf: str | None = Field(default=None, max_length=14)
    tipo_usuario: TipoUsuario | None = None
    ativo: bool | None = None


class UsuarioResponse(BaseModel):
    user_id: int
    nome: str
    cpf: str | None = None
    tipo_usuario: TipoUsuario = "INTERNO"
    uid_card: str | None
    vetor_facial: list[float] | None
    ativo: bool
    criado_em: datetime


class UsuarioSimplesResponse(BaseModel):
    """Versão leve sem vetor_facial e sem criado_em para dropdowns/seletores."""
    user_id: int
    nome: str
    cpf: str | None = None
    tipo_usuario: TipoUsuario = "INTERNO"
    uid_card: str | None
    ativo: bool
