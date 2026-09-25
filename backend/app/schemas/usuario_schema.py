from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.permissao_schema import PermissaoVinculoCreate


class UsuarioCreate(BaseModel):
    nome: str
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
    ativo: bool | None = None


class UsuarioResponse(BaseModel):
    user_id: int
    nome: str
    uid_card: str | None
    vetor_facial: list[float] | None
    ativo: bool
    criado_em: datetime


class UsuarioSimplesResponse(BaseModel):
    """Versão leve sem vetor_facial para dropdowns/seletores."""
    user_id: int
    nome: str
    uid_card: str | None
    ativo: bool
    criado_em: datetime