from typing import Optional
from pydantic import BaseModel

class TestarBiometriaResponse(BaseModel):
    status: str
    mensagem: str
    similaridade: float
    aprovado: bool
    usuario_id: int | None = None
    nome: str | None = None
    usuario: str | None = None
    min_similarity: Optional[float] = None