from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.auth.security import criar_token_jwt
from app.main import app
from app.models.dispositivo_model import dispositivo_model
from app.models.usuario_model import usuario_model


client = TestClient(app)


def auth_headers():
    token = criar_token_jwt(sub="1", email="admin@ardlock.local")
    return {"Authorization": f"Bearer {token}"}


def _fake_connection(rows):
    cursor = MagicMock()
    cursor.fetchall.return_value = rows

    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor

    @contextmanager
    def manager():
        yield connection

    return manager, cursor


def test_endpoint_usuarios_simples_nao_expoe_vetor_facial():
    payload = [
        {
            "user_id": 7,
            "nome": "Usuário Leve",
            "uid_card": "A1B2C3D4",
            "ativo": True,
        }
    ]

    with patch(
        "app.api.usuarios.usuario_service.listar_usuarios_simples",
        return_value=payload,
    ) as listar:
        response = client.get(
            "/api/v1/usuarios/simples?ativo=true",
            headers=auth_headers(),
        )

    assert response.status_code == 200
    assert response.json() == payload
    assert "vetor_facial" not in response.json()[0]
    assert "criado_em" not in response.json()[0]
    listar.assert_called_once_with(q=None, ativo=True)


def test_endpoint_dispositivos_simples_retorna_apenas_campos_de_dropdown():
    payload = [
        {
            "dispositivo_id": 3,
            "nome": "Leitor Entrada",
            "identificador": "ESP32-ENTRADA-01",
        }
    ]

    with patch(
        "app.api.dispositivos.dispositivo_service.listar_dispositivos_simples",
        return_value=payload,
    ) as listar:
        response = client.get(
            "/api/v1/dispositivos/simples?ativo=true",
            headers=auth_headers(),
        )

    assert response.status_code == 200
    assert response.json() == payload
    assert "local_id" not in response.json()[0]
    assert "criado_em" not in response.json()[0]
    listar.assert_called_once_with(q=None, ativo=True)


def test_usuario_model_simples_nao_busca_embedding():
    manager, cursor = _fake_connection(
        [(1, "Maria Silva", "A1B2C3D4", True)]
    )

    with patch("app.models.usuario_model.get_connection", manager):
        usuarios = usuario_model.listar_simples(ativo=True)

    sql = cursor.execute.call_args.args[0]
    assert "vetor_facial" not in sql.lower()
    assert usuarios == [
        {
            "user_id": 1,
            "nome": "Maria Silva",
            "uid_card": "A1B2C3D4",
            "ativo": True,
        }
    ]


def test_dispositivo_model_simples_nao_faz_join():
    manager, cursor = _fake_connection(
        [(2, "Leitor Laboratório", "ESP32-LAB-01")]
    )

    with patch("app.models.dispositivo_model.get_connection", manager):
        dispositivos = dispositivo_model.listar_simples(ativo=True)

    sql = cursor.execute.call_args.args[0].lower()
    assert " join " not in sql
    assert dispositivos == [
        {
            "dispositivo_id": 2,
            "nome": "Leitor Laboratório",
            "identificador": "ESP32-LAB-01",
        }
    ]
