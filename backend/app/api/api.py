from fastapi import APIRouter

from app.schemas.rfid_schema import RFIDRequest, RFIDResponse
from app.services.rfid_service import rfid_service

router = APIRouter()

@router.post("/rfid", response_model=RFIDResponse)
def validar_rfid(dados: RFIDRequest):
    veredito = rfid_service.validar_acesso(
        esp_id=dados.esp_id,
        uid_card=dados.uid_card,
    )

    return {
        "veredito": veredito
    }