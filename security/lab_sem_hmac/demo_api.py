"""Prova local da autenticação das rotas; serviços e broadcasts são simulados.

Não usa rede, banco real, câmeras ou dispositivo físico.
Executar no ambiente Python do backend, com a raiz backend no PYTHONPATH.
"""
from unittest.mock import patch
from uuid import UUID

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.rfid_schema import VerificarCartaoResponse, ResultadoTentativaResponse

ID = UUID("11111111-1111-4111-8111-111111111111")
client = TestClient(app)

with patch("app.api.rfid.manager.broadcast"), patch("app.api.rfid.manager.bind_capture", return_value=None), patch("app.api.rfid.acesso_service.iniciar_tentativa", return_value=VerificarCartaoResponse(existe=True, tentativa_id=ID, usuario_id=1, nome="Titular fictício", mensagem="Dados simulados", proxima_etapa="BIOMETRIA")) as start:
    response = client.post("/api/v1/arduino/verificar-cartao", json={"uid_card": "AABBCCDD", "identificador_dispositivo": "ESP32-LAB-FICTICIO"})
    assert response.status_code == 200, response.text
    start.assert_awaited_once_with(uid_card="AABBCCDD", identificador_dispositivo="ESP32-LAB-FICTICIO")
    print("1. Identidade de ESP32 declarada pelo cliente, sem assinatura/JWT: HTTP 200.")

with patch("app.api.rfid.acesso_service.obter_resultado_tentativa", return_value=ResultadoTentativaResponse(tentativa_id=ID, status="AUTORIZADO", comando="liberar", aprovado=True, similaridade=0.9, mensagem="Decisão fictícia", tempo_resposta_ms=1000)):
    response = client.get("/api/v1/arduino/resultado-acesso", params={"tentativa_id": str(ID), "identificador_dispositivo": "ESP32-LAB-FICTICIO"})
    assert response.status_code == 200, response.text
    print("2. Consulta de decisão sem assinatura/JWT: HTTP 200.")

with patch("app.api.rfid.acesso_service.verificar_face_tentativa") as face:
    response = client.post("/api/v1/arduino/verificar-face", params={"tentativa_id": str(ID)}, files={"file": ("ficticio.jpg", b"dados ficticios", "image/jpeg")})
    assert response.status_code == 401, response.text
    face.assert_not_called()
    print("3. Validação facial sem JWT: HTTP 401. Não houve bypass dessa autenticação.")

print("Limite: lógica de negócio simulada; HTTP 200 demonstra ausência de autenticação da rota, não aprovação facial real.")
