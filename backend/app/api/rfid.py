from fastapi import APIRouter, HTTPException, status
from app.schemas.rfid_schema import VerificarCartaoRequest, VerificarCartaoResponse
from app.services.rfid_service import rfid_service

router = APIRouter()

@router.post("/verificar-cartao", response_model=VerificarCartaoResponse)
async def verificar_cartao(request: VerificarCartaoRequest):
    """
    Recebe o UID do cartão lido pelo ESP32 e verifica se existe um usuário associado.
    """
    try:
        # Se chegou até aqui, o Pydantic já garantiu que request.uid_card é uma string válida pelo regex
        return rfid_service.verificar_cartao(request.uid_card)
        
    except Exception as e:
        # Registra o erro real no console para você conseguir debugar
        print(f"[RFID API Erro] {e}")
        
        # Levanta um 500 apenas se o banco de dados cair ou a lógica interna falhar
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno no servidor ao verificar o cartão."
        )