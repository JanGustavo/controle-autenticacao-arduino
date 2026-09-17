"""
Mantendo o protocolo pequeno e performático

EX:
{
    "esp_id": 1,
    "uid_card": "A1B2C3D4"
}
"""

from pydantic import BaseModel


class RFIDRequest(BaseModel):
    esp_id: int
    uid_card: str


class RFIDResponse(BaseModel):
    veredito: int