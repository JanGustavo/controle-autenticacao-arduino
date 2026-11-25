from typing import List
from time import monotonic
from fastapi import HTTPException
from fastapi import WebSocket

class ConnectionManager:
    """
    Gerenciador centralizado de conexões WebSocket.
    Mantém uma lista de clientes ativos (navegadores/totens) e transmite 
    mensagens em tempo real para todos os conectados.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.capture_client: str | None = None
        self.capture_revision = int(monotonic() * 1000)
        self.attempt_owners: dict[str, tuple[str | None, float]] = {}
        self.processing: set[str] = set()
        # Leitores reservados pelo painel para capturar um UID de cartão.
        # identificador normalizado -> (operacao_id, expira_em monotônico)
        self.card_captures: dict[str, tuple[str, float]] = {}

    @staticmethod
    def _reader_key(identificador: str) -> str:
        return (identificador or "").strip().upper()

    def arm_card_capture(self, identificador: str, operacao_id: str, ttl: float) -> None:
        """Reserva a próxima leitura do leitor para preencher um formulário.

        Uma nova reserva substitui a anterior do mesmo leitor; o evento
        carrega o operacao_id, então só a tela que pediu aplica o UID.
        """
        self.card_captures[self._reader_key(identificador)] = (str(operacao_id), monotonic() + ttl)

    def cancel_card_capture(self, identificador: str, operacao_id: str) -> bool:
        key = self._reader_key(identificador)
        current = self.card_captures.get(key)
        if current and current[0] == str(operacao_id):
            del self.card_captures[key]
            return True
        return False

    def take_card_capture(self, identificador: str) -> str | None:
        """Consome a reserva vigente do leitor (uso único)."""
        current = self.card_captures.pop(self._reader_key(identificador), None)
        if not current or current[1] <= monotonic():
            return None
        return current[0]

    def select_capture(self, client):
        self.capture_client = client
        self.capture_revision = max(self.capture_revision + 1, int(monotonic() * 1000))

    def capture_state(self):
        return {'cliente_id': self.capture_client, 'capture_revision': self.capture_revision}

    def bind_capture(self, attempt_id):
        now = monotonic()
        self.attempt_owners = {key: value for key, value in self.attempt_owners.items()
                               if value[1] > now}
        self.attempt_owners[str(attempt_id)] = (self.capture_client, now + 60)
        return self.capture_client

    def begin_capture(self, attempt_id, client):
        key = str(attempt_id)
        owner = self.attempt_owners.get(key)
        if owner and owner[0] is not None and (
            owner[0] != client or self.capture_client != client
        ):
            raise HTTPException(409, 'Esta tentativa pertence à câmera de outro aparelho. Leia o cartão novamente no aparelho selecionado.')
        if key in self.processing:
            raise HTTPException(409, 'A validação desta tentativa já está em andamento.')
        self.processing.add(key)


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
