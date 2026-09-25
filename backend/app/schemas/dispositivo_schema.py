from datetime import datetime

from pydantic import BaseModel, Field


class DispositivoCreate(BaseModel):
    local_id: int = Field(gt=0)
    nome: str = Field(min_length=2, max_length=255)
    identificador: str = Field(min_length=1, max_length=100)
    ativo: bool = True


class DispositivoUpdate(BaseModel):
    local_id: int | None = Field(default=None, gt=0)
    nome: str | None = Field(default=None, min_length=2, max_length=255)
    identificador: str | None = Field(default=None, min_length=1, max_length=100)
    ativo: bool | None = None


class DispositivoResponse(BaseModel):
    dispositivo_id: int
    local_id: int
    nome: str
    identificador: str
    ativo: bool
    criado_em: datetime


class DispositivoSimplesResponse(BaseModel):
    """Payload mínimo para dropdowns e leitores RFID."""
    dispositivo_id: int
    nome: str
    identificador: str
