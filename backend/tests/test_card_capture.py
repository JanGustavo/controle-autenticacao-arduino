"""Leitura de cartão reservada pelo painel não pode iniciar acesso nem biometria."""
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.auth.dependencies import obter_administrador_atual
from app.main import app
from app.schemas.websocket_schema import ConnectionManager

LEITURA = {"uid_card": "AABBCCDD", "identificador_dispositivo": "ESP32-TESTE"}


def _admin():
    app.dependency_overrides[obter_administrador_atual] = lambda: {"admin_id": 1}


def _sem_admin():
    app.dependency_overrides.pop(obter_administrador_atual, None)


def test_reserva_e_de_uso_unico_e_expira(monkeypatch):
    manager = ConnectionManager()
    relogio = [100.0]
    monkeypatch.setattr("app.schemas.websocket_schema.monotonic", lambda: relogio[0])

    manager.arm_card_capture("esp32-teste ", "op-1", ttl=30)
    assert manager.take_card_capture("ESP32-TESTE") == "op-1"
    assert manager.take_card_capture("ESP32-TESTE") is None

    manager.arm_card_capture("ESP32-TESTE", "op-2", ttl=30)
    relogio[0] += 31
    assert manager.take_card_capture("ESP32-TESTE") is None


def test_cancelamento_so_remove_a_propria_operacao():
    manager = ConnectionManager()
    manager.arm_card_capture("ESP32-TESTE", "op-nova", ttl=30)
    assert manager.cancel_card_capture("ESP32-TESTE", "op-antiga") is False
    assert manager.cancel_card_capture("ESP32-TESTE", "op-nova") is True
    assert manager.take_card_capture("ESP32-TESTE") is None


def test_reserva_exige_administrador():
    resposta = TestClient(app).post(
        "/api/v1/arduino/captura-cartao",
        json={"identificador_dispositivo": "ESP32-TESTE", "operacao_id": str(uuid4())},
    )
    assert resposta.status_code == 401


def test_leitura_reservada_so_entrega_o_uid(monkeypatch):
    manager = ConnectionManager()
    manager.broadcast = AsyncMock()
    monkeypatch.setattr("app.api.rfid.manager", manager)
    operacao = str(uuid4())
    _admin()
    try:
        cliente = TestClient(app)
        reserva = cliente.post(
            "/api/v1/arduino/captura-cartao",
            json={"identificador_dispositivo": "ESP32-TESTE", "operacao_id": operacao},
        )
        assert reserva.status_code == 200
        assert reserva.json()["expira_em_segundos"] == 30

        with patch("app.api.rfid.acesso_service.iniciar_tentativa") as iniciar:
            resposta = cliente.post("/api/v1/arduino/verificar-cartao", json=LEITURA)
    finally:
        _sem_admin()

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["proxima_etapa"] == "CARTAO_CAPTURADO"
    # O firmware trata `null` como texto; sem o campo, ele encerra a leitura na hora.
    assert "tentativa_id" not in corpo
    iniciar.assert_not_called()

    eventos = [chamada.args[0] for chamada in manager.broadcast.await_args_list]
    assert [evento["type"] for evento in eventos] == ["RFID_LIDO"]
    assert eventos[0]["data"]["operacao_id"] == operacao
    assert eventos[0]["data"]["uid_card"] == "AABBCCDD"


def test_leitura_sem_reserva_segue_o_fluxo_de_acesso(monkeypatch):
    manager = ConnectionManager()
    manager.broadcast = AsyncMock()
    monkeypatch.setattr("app.api.rfid.manager", manager)
    with patch(
        "app.api.rfid.acesso_service.iniciar_tentativa",
        side_effect=RuntimeError("sem banco"),
    ) as iniciar:
        resposta = TestClient(app).post("/api/v1/arduino/verificar-cartao", json=LEITURA)
    iniciar.assert_called_once()
    assert resposta.status_code == 500
    primeiro = manager.broadcast.await_args_list[0].args[0]
    assert primeiro["type"] == "RFID_LIDO"
    assert "operacao_id" not in primeiro["data"]


def test_cancelar_libera_o_leitor_para_acesso(monkeypatch):
    manager = ConnectionManager()
    manager.broadcast = AsyncMock()
    monkeypatch.setattr("app.api.rfid.manager", manager)
    operacao = str(uuid4())
    _admin()
    try:
        cliente = TestClient(app)
        cliente.post(
            "/api/v1/arduino/captura-cartao",
            json={"identificador_dispositivo": "ESP32-TESTE", "operacao_id": operacao},
        )
        cancelamento = cliente.delete(
            "/api/v1/arduino/captura-cartao",
            params={"identificador_dispositivo": "ESP32-TESTE", "operacao_id": operacao},
        )
    finally:
        _sem_admin()
    assert cancelamento.status_code == 204
    assert manager.take_card_capture("ESP32-TESTE") is None
