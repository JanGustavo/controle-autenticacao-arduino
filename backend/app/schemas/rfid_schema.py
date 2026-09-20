from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

class VerificarCartaoRequest(BaseModel):
    uid_card: str = Field(
        ...,
        min_length=8,
        max_length=20,
        description="UID do cartão lido pelo ESP32 (hex, 8, 14 ou 20 chars)"
    )

    @field_validator('uid_card')
    @classmethod
    def validar_formato_uid(cls, v: str) -> str:
        padrao = r"^[0-9A-Fa-f]{8}$|^[0-9A-Fa-f]{14}$|^[0-9A-Fa-f]{20}$"
        if not re.fullmatch(padrao, v):
            raise ValueError(
                "Formato de UID inválido. Esperado uma string hexadecimal "
                "(0-9, A-F) com exatamente 8, 14 ou 20 caracteres."
            )
        # Padroniza para maiúsculo antes de chegar no Service/Banco de Dados
        return v.upper()

class VerificarCartaoResponse(BaseModel):
    valido: bool
    usuario_id: Optional[int] = None
    nome: Optional[str] = None
    mensagem: str