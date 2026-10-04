from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from uuid import UUID
from pydantic import BaseModel
from app.auth.dependencies import obter_administrador_atual
from app.schemas.websocket_schema import manager

router = APIRouter()

class CaptureStation(BaseModel):
    cliente_id: UUID

@router.post('/api/v1/captura/ativar')
async def activate_capture(body: CaptureStation, _admin=Depends(obter_administrador_atual)):
    manager.select_capture(str(body.cliente_id))
    await manager.broadcast({'type': 'ESTACAO_CAPTURA', 'data': manager.capture_state()})
    return manager.capture_state()


@router.websocket("/ws/logs")
async def websocket_logs_endpoint(websocket: WebSocket, cliente_id: UUID | None = None):
    """
    Endpoint WebSocket para streaming em tempo real do histórico de acessos.
    Permite que o dashboard e totens recebam notificações instantâneas a cada tentativa.
    """
    await manager.connect(websocket)
    await websocket.send_json({'type': 'ESTACAO_CAPTURA', 'data': manager.capture_state()})
    try:
        while True:
            # Mantém a conexão aberta aguardando ou recebendo pings do cliente
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
