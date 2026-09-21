from fastapi import APIRouter, HTTPException, status
from app.schemas.rfid_schema import (
    VerificarCartaoRequest,
    VerificarCartaoResponse,
    ResultadoBiometriaRequest,
    VerificarBiometriaArduinoRequest,
)
from app.services.rfid_service import rfid_service

router = APIRouter()


@router.post("/verificar-cartao", response_model=VerificarCartaoResponse)
async def verificar_cartao(request: VerificarCartaoRequest):
    """
    Recebe o UID do cartão lido pelo ESP32 e verifica se existe um usuário associado.
    """
    try:
        # Se chegou até aqui, o Pydantic já garantiu que request.uid_card é uma string válida pelo regex
        print(f"ESP_ID: {request.esp_id}")
        print(f"UUID: {request.uid_card}")
        return rfid_service.verificar_cartao(request.uid_card)
        
    except Exception as e:
        # Registra o erro real no console para você conseguir debugar
        print(f"[RFID API Erro] {e}")
        
        # Levanta um 500 apenas se o banco de dados cair ou a lógica interna falhar
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno no servidor ao verificar o cartão."
        )


@router.post("/resultado-biometria")
async def receber_resultado_biometria(
    resultado: VerificarBiometriaArduinoRequest,
):
    """
    Recebe a requisição do ESP32 consultando o veredito da biometria.
    """
    print(f"[ESP32 Biometria Query] ESP_ID: {resultado.esp_id} | UID: {resultado.uid_card}")

    aprovado_por_biometria = True 

    if aprovado_por_biometria:
        print(f"[HARDWARE] 🟢 ACESSO LIBERADO | UID: {resultado.uid_card}")
    else:
        print(f"[HARDWARE] 🔴 ACESSO NEGADO | UID: {resultado.uid_card}")

    return {
        "usuario_id": 4,
        "nome": "Lucas Admin",
        "aprovado": aprovado_por_biometria,
        "similaridade": 0.95,
        "mensagem": "Verificação biométrica concluída."
    }