from typing import List
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    """
    Gerenciador centralizado de conexões WebSocket.
    Mantém uma lista de clientes ativos (navegadores/totens) e transmite 
    mensagens em tempo real para todos os conectados.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Envia um evento JSON em tempo real para todos os clientes conectados."""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Trata eventuais desconexões abruptas sem quebrar o broadcast
                pass

manager = ConnectionManager()
