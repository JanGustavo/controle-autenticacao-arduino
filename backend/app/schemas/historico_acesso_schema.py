from datetime import datetime

from pydantic import BaseModel


class HistoricoAcessoResponse(BaseModel):
    id: int
    usuario_id: int | None
    local_id: int | None
    dispositivo_id: int | None = None
    uid_card_lido: str | None
    data_hora: datetime
    autorizado: bool
    percentual_similaridade: float | None
    motivo_recusa: str | None


class HistoricoAcessoCreate(BaseModel):
    usuario_id: int | None = None
    local_id: int | None = None
    dispositivo_id: int | None = None
    uid_card_lido: str | None = None
    data_hora: datetime | None = None
    autorizado: bool
    percentual_similaridade: float | None = None
    motivo_recusa: str | None = None
