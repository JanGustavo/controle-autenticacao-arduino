from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.schemas.websocket_schema import manager

router = APIRouter()

@router.websocket("/ws/logs")
async def websocket_logs_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket para streaming em tempo real do histórico de acessos.
    Permite que o dashboard e totens recebam notificações instantâneas a cada tentativa.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Mantém a conexão aberta aguardando ou recebendo pings do cliente
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
