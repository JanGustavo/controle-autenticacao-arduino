import os
from datetime import datetime, time, timedelta
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "super_secret_test_jwt_key_2026_at_least_32_chars_long")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")

from app.main import app
from app.schemas.face_schema import FaceVectorResponse

client = TestClient(app)

DUMMY_VECTOR = [0.05] * 512
DUMMY_DIFF_VECTOR = [-0.05] * 512


def _mock_db_connection():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    return mock_conn, mock_cursor


def test_fluxo_acesso_1to1_aprovado():
    """
    Testa o fluxo estrito 1:1 sem dependência de hardware:
    1. Simula leitura do RFID via POST /verificar-cartao.
    2. Recebe tentativa_id PENDENTE.
    3. Envia foto facial via POST /verificar-face?tentativa_id=...
    4. Valida se o backend compara 1:1 contra o titular e aprova com comando 'liberar'.
    """
    mock_conn, _ = _mock_db_connection()

    with patch("app.services.acesso_service.get_connection", return_value=mock_conn), \
         patch("app.database.connection.get_connection", return_value=mock_conn), \
         patch("app.services.acesso_service.dispositivo_model.buscar_por_identificador") as mock_disp, \
         patch("app.services.acesso_service.local_model.buscar_por_id") as mock_local, \
         patch("app.services.acesso_service.usuario_model.buscar_por_uid") as mock_user, \
         patch("app.services.acesso_service.permissao_model.buscar_por_usuario_local") as mock_perm, \
         patch("app.services.acesso_service.tentativa_acesso_model.criar_com_cursor"), \
         patch("app.api.rfid.manager.broadcast"):

        mock_disp.return_value = {"dispositivo_id": 1, "local_id": 1, "identificador": "ESP32-ENTRADA-01", "ativo": True}
        mock_local.return_value = {"local_id": 1, "nome": "Entrada principal", "ativo": True}
        mock_user.return_value = {"user_id": 10, "nome": "Carlos Teste", "uid_card": "A1B2C3D4", "ativo": True}
        mock_perm.return_value = {
            "horario_inicio": time(0, 0, 0),
            "horario_fim": time(23, 59, 59),
            "dias_semana": [1, 2, 3, 4, 5, 6, 7],
        }

        # 1. Simula leitura do RFID
        res_cartao = client.post(
            "/api/v1/arduino/verificar-cartao",
            json={"uid_card": "A1B2C3D4", "identificador_dispositivo": "ESP32-ENTRADA-01"}
        )
        assert res_cartao.status_code == 200
        dados_cartao = res_cartao.json()
        assert dados_cartao["existe"] is True
        assert dados_cartao["proxima_etapa"] == "BIOMETRIA"
        tentativa_id = dados_cartao["tentativa_id"]

    # 2. Simula envio de face e validação 1:1 estrita
    with patch("app.services.acesso_service.get_connection", return_value=mock_conn), \
         patch("app.database.connection.get_connection", return_value=mock_conn), \
         patch("app.services.acesso_service.tentativa_acesso_model.buscar_por_id") as mock_tentativa, \
         patch("app.services.acesso_service.usuario_model.buscar_por_id") as mock_user_id, \
         patch("app.services.acesso_service.FaceService.extract_face_vector_detailed") as mock_extract, \
         patch("app.services.acesso_service.tentativa_acesso_model.buscar_contexto_finalizacao_com_cursor") as mock_ctx, \
         patch("app.services.acesso_service.tentativa_acesso_model.finalizar_com_cursor"), \
         patch("app.services.acesso_service.historico_acesso_model.criar_com_cursor"), \
         patch("app.api.rfid.manager.broadcast"):

        criado = datetime.now() - timedelta(milliseconds=250)

        mock_tentativa.return_value = {
            "tentativa_id": tentativa_id,
            "usuario_id": 10,
            "status": "PENDENTE",
        }
        # Usuário titular possui o DUMMY_VECTOR
        mock_user_id.return_value = {
            "user_id": 10,
            "nome": "Carlos Teste",
            "vetor_facial": DUMMY_VECTOR,
            "ativo": True,
        }
        mock_extract.return_value = FaceVectorResponse(
            success=True,
            message="Face detectada",
            vector=DUMMY_VECTOR,
        )
        mock_ctx.return_value = {
            "tentativa_id": tentativa_id,
            "usuario_id": 10,
            "local_id": 1,
            "dispositivo_id": 1,
            "uid_card_lido": "A1B2C3D4",
            "status": "PENDENTE",
            "expira_em": datetime.now() + timedelta(seconds=15),
            "criado_em": criado,
            "nome_usuario": "Carlos Teste",
            "usuario_ativo": True,
            "local_ativo": True,
            "dispositivo_ativo": True,
            "horario_inicio": time(0, 0, 0),
            "horario_fim": time(23, 59, 59),
            "dias_semana": [1, 2, 3, 4, 5, 6, 7],
        }

        fake_photo = b"fake-jpeg-photo-content"
        res_face = client.post(
            f"/api/v1/arduino/verificar-face?tentativa_id={tentativa_id}",
            files={"file": ("face.jpg", fake_photo, "image/jpeg")},
        )
        assert res_face.status_code == 200
        dados_face = res_face.json()
        assert dados_face["aprovado"] is True
        assert dados_face["comando"] == "liberar"
        assert dados_face["similaridade"] == 1.0
        assert dados_face["tempo_resposta_ms"] is not None
        assert dados_face["tempo_resposta_ms"] >= 0


def test_fluxo_acesso_1to1_rosto_diferente_negado():
    """
    Testa se o fluxo 1:1 rejeita quando a face enviada não corresponde
    ao titular do cartão.
    """
    tentativa_id = "00000000-0000-0000-0000-000000000001"
    mock_conn, _ = _mock_db_connection()

    with patch("app.services.acesso_service.get_connection", return_value=mock_conn), \
         patch("app.database.connection.get_connection", return_value=mock_conn), \
         patch("app.services.acesso_service.tentativa_acesso_model.buscar_por_id") as mock_tentativa, \
         patch("app.services.acesso_service.usuario_model.buscar_por_id") as mock_user_id, \
         patch("app.services.acesso_service.FaceService.extract_face_vector_detailed") as mock_extract, \
         patch("app.services.acesso_service.tentativa_acesso_model.buscar_contexto_finalizacao_com_cursor") as mock_ctx, \
         patch("app.services.acesso_service.tentativa_acesso_model.finalizar_com_cursor"), \
         patch("app.services.acesso_service.historico_acesso_model.criar_com_cursor"), \
         patch("app.api.rfid.manager.broadcast"):

        mock_tentativa.return_value = {
            "tentativa_id": tentativa_id,
            "usuario_id": 10,
            "status": "PENDENTE",
        }
        # Usuário titular possui DUMMY_VECTOR
        mock_user_id.return_value = {
            "user_id": 10,
            "nome": "Carlos Teste",
            "vetor_facial": DUMMY_VECTOR,
            "ativo": True,
        }
        # Face detectada é de outra pessoa (DUMMY_DIFF_VECTOR)
        mock_extract.return_value = FaceVectorResponse(
            success=True,
            message="Face detectada",
            vector=DUMMY_DIFF_VECTOR,
        )
        mock_ctx.return_value = {
            "tentativa_id": tentativa_id,
            "usuario_id": 10,
            "local_id": 1,
            "dispositivo_id": 1,
            "uid_card_lido": "A1B2C3D4",
            "status": "PENDENTE",
            "expira_em": datetime.now() + timedelta(seconds=15),
            "criado_em": datetime.now() - timedelta(milliseconds=100),
            "nome_usuario": "Carlos Teste",
            "usuario_ativo": True,
            "local_ativo": True,
            "dispositivo_ativo": True,
            "horario_inicio": time(0, 0, 0),
            "horario_fim": time(23, 59, 59),
            "dias_semana": [1, 2, 3, 4, 5, 6, 7],
        }

        fake_photo = b"fake-jpeg-photo-content"
        res_face = client.post(
            f"/api/v1/arduino/verificar-face?tentativa_id={tentativa_id}",
            files={"file": ("face.jpg", fake_photo, "image/jpeg")},
        )
        assert res_face.status_code == 200
        dados_face = res_face.json()
        assert dados_face["aprovado"] is False
        assert dados_face["comando"] == "negar"
        assert dados_face["similaridade"] < 0.8
        assert "insuficiente" in dados_face["mensagem"]
