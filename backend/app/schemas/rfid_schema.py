from typing import Optional, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator
import re

_PADRAO_UID = r"^[0-9A-Fa-f]{8}$|^[0-9A-Fa-f]{14}$|^[0-9A-Fa-f]{20}$"


def _validar_uid(v: str) -> str:
    if not re.fullmatch(_PADRAO_UID, v):
        raise ValueError(
            "Formato de UID inválido. Esperado uma string hexadecimal "
            "(0-9, A-F) com exatamente 8, 14 ou 20 caracteres."
        )
    return v.upper()


class CadastrarCartaoRequest(BaseModel):
    # O firmware envia o identificador lógico do dispositivo cadastrado
    # na tabela dispositivo.
    identificador_dispositivo: str = Field(
        ..., min_length=1, description="Identificador do dispositivo que originou a requisição"
    )
    uid_card: str = Field(..., description="UID do cartão lido pelo leitor RFID")
    usuario_id: int = Field(..., gt=0, description="ID do usuário que vai receber o cartão")

    @field_validator("uid_card")
    @classmethod
    def validar_formato_uid(cls, v: str) -> str:
        return _validar_uid(v)


class CadastrarCartaoResponse(BaseModel):
    sucesso: bool
    usuario_id: Optional[int] = None
    uid_card: Optional[str] = None
    mensagem: str


class VerificarCartaoRequest(BaseModel):
    identificador_dispositivo: str = Field(
        ..., min_length=1, description="Identificador do dispositivo cadastrado"
    )
    uid_card: str = Field(
        ...,
        min_length=8,
        max_length=20,
        description="UID do cartão lido pelo ESP32 (hex, 8, 14 ou 20 chars)",
    )

    @field_validator("uid_card")
    @classmethod
    def validar_formato_uid(cls, v: str) -> str:
        return _validar_uid(v)


class VerificarCartaoResponse(BaseModel):
    # Renomeado de 'valido' para 'existe' -- é o nome que o firmware do
    # ESP32 já espera no JSON de resposta do POST /verificar-cartao.
    existe: bool
    tentativa_id: UUID | None = None
    usuario_id: Optional[int] = None
    nome: Optional[str] = None
    mensagem: str
    proxima_etapa: Literal["BIOMETRIA", "NEGADO"] = "NEGADO"


class ResultadoBiometriaRequest(BaseModel):
    usuario_id: Optional[int] = None
    nome: Optional[str] = None
    aprovado: bool
    similaridade: float = Field(
        ..., ge=0.0, le=1.0, description="Similaridade facial calculada entre 0.0 e 1.0"
    )


class VerificarBiometriaArduinoRequest(BaseModel):
    identificador_dispositivo: str = Field(
        ..., min_length=1, description="Identificador do dispositivo cadastrado"
    )
    uid_card: str = Field(..., description="UID do cartão para associar a busca")

    @field_validator("uid_card")
    @classmethod
    def validar_formato_uid(cls, v: str) -> str:
        return _validar_uid(v)


class VerificarBiometriaArduinoResponse(BaseModel):
    tentativa_id: UUID | None = None
    usuario_id: Optional[int] = None
    nome: Optional[str] = None
    local_id: Optional[int] = None
    aprovado: bool
    similaridade: float = Field(default=0.0, ge=0.0, le=1.0)
    comando: Literal["liberar", "negar"] = "negar"
    mensagem: str
    tempo_resposta_ms: Optional[int] = Field(
        default=None,
        description="Tempo total decorrido entre a leitura do RFID e a decisão final (em ms)",
    )
