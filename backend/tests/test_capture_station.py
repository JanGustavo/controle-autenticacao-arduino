from uuid import uuid4
import pytest
from fastapi import HTTPException
from app.schemas.websocket_schema import ConnectionManager


def test_only_selected_station_can_submit_attempt():
    manager = ConnectionManager()
    manager.capture_client = 'phone'
    attempt = uuid4()
    assert manager.bind_capture(attempt) == 'phone'
    with pytest.raises(HTTPException) as error:
        manager.begin_capture(attempt, 'laptop')
    assert error.value.status_code == 409
    assert not manager.processing
    manager.begin_capture(attempt, 'phone')
    with pytest.raises(HTTPException):
        manager.begin_capture(attempt, 'phone')


def test_transfer_does_not_reassign_existing_attempt():
    manager = ConnectionManager()
    manager.capture_client = 'phone'
    attempt = uuid4()
    manager.bind_capture(attempt)
    manager.capture_client = 'laptop'
    for client in ['phone','laptop']:
        with pytest.raises(HTTPException):
            manager.begin_capture(attempt,client)
    next_attempt = uuid4()
    manager.bind_capture(next_attempt)
    manager.begin_capture(next_attempt,'laptop')


def test_capture_selection_requires_authentication():
    from fastapi.testclient import TestClient
    from app.main import app
    response = TestClient(app).post('/api/v1/captura/ativar', json={'cliente_id':str(uuid4())})
    assert response.status_code == 401


def test_other_station_rejected_before_face_processing(monkeypatch):
    from fastapi.testclient import TestClient
    from unittest.mock import Mock
    from app.main import app
    from app.auth.dependencies import obter_administrador_atual
    manager = ConnectionManager()
    phone, laptop, attempt = uuid4(), uuid4(), uuid4()
    manager.capture_client = str(phone)
    manager.bind_capture(attempt)
    monkeypatch.setattr('app.api.rfid.manager', manager)
    infer = Mock()
    monkeypatch.setattr('app.api.rfid.acesso_service.verificar_face_tentativa', infer)
    app.dependency_overrides[obter_administrador_atual] = lambda: {'admin_id':1}
    try:
        response = TestClient(app).post('/api/v1/arduino/verificar-face',
            params={'tentativa_id':str(attempt),'cliente_id':str(laptop)},
            files={'file':('test.jpg',b'no hardware','image/jpeg')})
        assert response.status_code == 409
        infer.assert_not_called()
    finally:
        app.dependency_overrides.pop(obter_administrador_atual,None)


def test_finished_attempt_returns_persisted_result_without_inference(monkeypatch):
    from unittest.mock import Mock
    from app.services.acesso_service import AcessoService
    monkeypatch.setattr('app.services.acesso_service.tentativa_acesso_model.buscar_por_id',
                        lambda _: {'status':'AUTORIZADO'})
    final = Mock(return_value='persisted')
    monkeypatch.setattr(AcessoService, '_finalizar_tentativa', final)
    infer = Mock()
    monkeypatch.setattr('app.services.acesso_service.FaceService.extract_face_vector_detailed',infer)
    assert AcessoService.verificar_face_tentativa(uuid4(),b'no image') == 'persisted'
    infer.assert_not_called()
    final.assert_called_once()
