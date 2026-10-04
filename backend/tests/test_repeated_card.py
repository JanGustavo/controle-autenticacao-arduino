import asyncio
from contextlib import ExitStack
from datetime import time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from psycopg.errors import UniqueViolation

from app.main import app
from app.services.acesso_service import acesso_service, TentativaEmAndamentoError


class DuplicatePending(UniqueViolation):
    @property
    def diag(self):
        return SimpleNamespace(constraint_name="uq_tentativa_pendente_dispositivo_cartao")


def start_card(*, duplicate=False):
    connection = MagicMock()
    with ExitStack() as stack:
        base = "app.services.acesso_service."
        stack.enter_context(patch(base + "get_connection", return_value=connection))
        stack.enter_context(patch(base + "dispositivo_model.buscar_por_identificador", return_value={"dispositivo_id": 1, "local_id": 1, "ativo": True}))
        stack.enter_context(patch(base + "local_model.buscar_por_id", return_value={"local_id": 1, "ativo": True}))
        stack.enter_context(patch(base + "usuario_model.buscar_por_uid", return_value={"user_id": 1, "nome": "Teste", "ativo": True}))
        stack.enter_context(patch(base + "permissao_model.buscar_por_usuario_local", return_value={"horario_inicio": time(0), "horario_fim": time(23, 59, 59), "dias_semana": list(range(1, 8))}))
        expire = stack.enter_context(patch(base + "tentativa_acesso_model.expirar_pendentes_com_cursor", return_value=[{"usuario_id": 1, "local_id": 1, "dispositivo_id": 1, "uid_card_lido": "AABBCCDD"}]))
        history = stack.enter_context(patch(base + "historico_acesso_model.criar_com_cursor"))
        create = stack.enter_context(patch(base + "tentativa_acesso_model.criar_com_cursor"))
        order = MagicMock()
        order.attach_mock(expire, "expire")
        order.attach_mock(history, "history")
        order.attach_mock(create, "create")
        if duplicate:
            create.side_effect = DuplicatePending()
            with pytest.raises(TentativaEmAndamentoError):
                asyncio.run(acesso_service.iniciar_tentativa("AABBCCDD", "ESP32-TESTE"))
        else:
            result = asyncio.run(acesso_service.iniciar_tentativa("AABBCCDD", "ESP32-TESTE"))
            assert result.proxima_etapa == "BIOMETRIA"
            assert [call[0] for call in order.mock_calls] == ["expire", "history", "create"]
            assert history.call_args.kwargs["autorizado"] is False


def test_expired_card_is_released_with_history_before_new_attempt():
    start_card()


def test_duplicate_pending_card_is_a_domain_conflict():
    start_card(duplicate=True)


def test_duplicate_card_returns_409_without_rebinding_camera():
    with patch("app.api.rfid.acesso_service.iniciar_tentativa", side_effect=TentativaEmAndamentoError("Aguarde a tentativa atual.")), patch("app.api.rfid.manager.broadcast"), patch("app.api.rfid.manager.bind_capture") as bind:
        response = TestClient(app).post("/api/v1/arduino/verificar-cartao", json={"uid_card": "AABBCCDD", "identificador_dispositivo": "ESP32-TESTE"})
    assert response.status_code == 409
    assert response.json()["detail"] == "Aguarde a tentativa atual."
    bind.assert_not_called()
