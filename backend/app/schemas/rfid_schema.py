from typing import Optional, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
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
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "identificador_dispositivo": "ESP32-ENTRADA-01",
                "uid_card": "A1B2C3D4",
                "usuario_id": 17,
            }
        }
    )
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
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "identificador_dispositivo": "ESP32-ENTRADA-01",
                "uid_card": "A1B2C3D4",
            }
        }
    )
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
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "existe": True,
                "tentativa_id": "3b75c2c1-1e6d-4f52-9aa3-45f59ce77700",
                "usuario_id": 17,
                "nome": "Jan",
                "mensagem": "Cartão reconhecido e dentro da permissão. Aguardando validação facial.",
                "proxima_etapa": "BIOMETRIA",
            }
        }
    )
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


class ResultadoTentativaResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tentativa_id": "3b75c2c1-1e6d-4f52-9aa3-45f59ce77700",
                "status": "AUTORIZADO",
                "comando": "liberar",
                "aprovado": True,
                "similaridade": 0.91,
                "mensagem": "Acesso autorizado.",
                "tempo_resposta_ms": 1432,
            }
        }
    )
    tentativa_id: UUID
    status: Literal["PENDENTE", "AUTORIZADO", "NEGADO", "EXPIRADO"]
    comando: Literal["aguardar", "liberar", "negar"]
    aprovado: Optional[bool] = None
    similaridade: float = Field(default=0.0, ge=0.0, le=1.0)
    mensagem: str
    tempo_resposta_ms: Optional[int] = None


class VerificarBiometriaArduinoResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "tentativa_id": "3b75c2c1-1e6d-4f52-9aa3-45f59ce77700",
                "usuario_id": 17,
                "nome": "Jan",
                "local_id": 1,
                "aprovado": True,
                "similaridade": 0.91,
                "comando": "liberar",
                "mensagem": "Acesso autorizado.",
                "tempo_resposta_ms": 1432,
            }
        }
    )
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
