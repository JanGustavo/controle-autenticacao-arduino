import os
from datetime import timedelta
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "super_secret_test_jwt_key_2026_at_least_32_chars_long")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")

from app.auth.security import criar_token_jwt
from app.main import app

client = TestClient(app)

ADMIN_MOCK = (1, "Admin Teste", "admin@ardlock.local", True)


def mock_get_conn_admin(admin_row=ADMIN_MOCK):
    fake_cursor = MagicMock()
    fake_cursor.fetchone.return_value = admin_row
    fake_connection = MagicMock()
    fake_connection.cursor.return_value.__enter__.return_value = fake_cursor
    mock_conn = MagicMock()
    mock_conn.__enter__.return_value = fake_connection
    return mock_conn


# 1. Sem autenticação (ausência de token) -> 401
@pytest.mark.parametrize(
    "path,method",
    [
        ("/api/v1/usuarios", "GET"),
        ("/api/v1/usuarios", "POST"),
        ("/api/v1/usuarios/1", "GET"),
        ("/api/v1/usuarios/1", "PATCH"),
        ("/api/v1/usuarios/1", "DELETE"),
        ("/api/v1/locais", "GET"),
        ("/api/v1/locais", "POST"),
        ("/api/v1/locais/1", "GET"),
        ("/api/v1/locais/1", "PATCH"),
        ("/api/v1/locais/1", "DELETE"),
        ("/api/v1/permissoes", "GET"),
        ("/api/v1/permissoes", "POST"),
        ("/api/v1/permissoes/1", "GET"),
        ("/api/v1/permissoes/1", "PATCH"),
        ("/api/v1/permissoes/1", "DELETE"),
        ("/api/v1/historico-acesso", "GET"),
        ("/api/v1/historico-acesso", "POST"),
        ("/api/v1/historico-acesso/1", "GET"),
        ("/api/v1/biometria/cadastrar/1", "POST"),
    ],
)
def test_endpoints_protegidos_sem_token_retornam_401(path: str, method: str):
    response = client.request(method, path)
    assert response.status_code == 401
    assert response.headers.get("WWW-Authenticate") == "Bearer"


# 2. Com token válido -> Sucesso (200 / 201)
def test_endpoint_protegido_com_token_valido():
    token = criar_token_jwt(sub="1", email="admin@ardlock.local")
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.auth.dependencies.get_connection", return_value=mock_get_conn_admin()), \
         patch("app.api.usuarios.usuario_service.listar_usuarios", return_value=[]):
        response = client.get("/api/v1/usuarios", headers=headers)

    assert response.status_code == 200


# 3. Rejeição de tokens inválidos
def test_token_malformado_retorna_401():
    headers = {"Authorization": "Bearer token_completamente_invalido"}
    response = client.get("/api/v1/usuarios", headers=headers)
    assert response.status_code == 401


def test_token_esquema_invalido_retorna_401():
    token = criar_token_jwt(sub="1", email="admin@ardlock.local")
    headers = {"Authorization": f"Basic {token}"}
    response = client.get("/api/v1/usuarios", headers=headers)
    assert response.status_code == 401


def test_token_expirado_retorna_401():
    token_expirado = criar_token_jwt(
        sub="1", email="admin@ardlock.local", expires_delta=timedelta(seconds=-10)
    )
    headers = {"Authorization": f"Bearer {token_expirado}"}
    response = client.get("/api/v1/usuarios", headers=headers)
    assert response.status_code == 401


def test_token_assinatura_invalida_retorna_401():
    token_outro_secret = jwt.encode(
        {"sub": "1", "email": "admin@ardlock.local"},
        "chave_secreta_errada",
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {token_outro_secret}"}
    response = client.get("/api/v1/usuarios", headers=headers)
    assert response.status_code == 401


def test_token_sem_sub_retorna_401():
    token_sem_sub = jwt.encode(
        {"email": "admin@ardlock.local"},
        os.environ["JWT_SECRET"],
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {token_sem_sub}"}
    response = client.get("/api/v1/usuarios", headers=headers)
    assert response.status_code == 401


def test_token_admin_inexistente_retorna_401():
    token = criar_token_jwt(sub="999", email="inexistente@ardlock.local")
    headers = {"Authorization": f"Bearer {token}"}

    with patch("app.auth.dependencies.get_connection", return_value=mock_get_conn_admin(admin_row=None)):
        response = client.get("/api/v1/usuarios", headers=headers)

    assert response.status_code == 401


def test_token_admin_desativado_retorna_401():
    token = criar_token_jwt(sub="1", email="admin@ardlock.local")
    headers = {"Authorization": f"Bearer {token}"}
    admin_inativo = (1, "Admin Desativado", "admin@ardlock.local", False)

    with patch("app.auth.dependencies.get_connection", return_value=mock_get_conn_admin(admin_row=admin_inativo)):
        response = client.get("/api/v1/usuarios", headers=headers)

    assert response.status_code == 401


# 4. Endpoints públicos funcionam sem token
def test_endpoints_publicos_respondem_sem_token():
    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/api/v1/health/db").status_code in (200, 503)


# 5. Fluxo de integração completo
def test_fluxo_integracao_autenticacao():
    # 1. Login com credenciais válidas
    with patch("app.auth.service.get_connection") as mock_conn_service:
        fake_cursor = MagicMock()
        fake_cursor.fetchone.return_value = (
            1, "Admin", "admin@ardlock.local",
            "$2b$12$aINBb4hKDDfrK3FBd1CpIul9Q3LrB9aT5vceZUbsVBQF8I/aKKlA6", True, None
        )
        fake_connection = MagicMock()
        fake_connection.cursor.return_value.__enter__.return_value = fake_cursor
        mock_conn_service.return_value.__enter__.return_value = fake_connection

        res_login = client.post(
            "/api/v1/auth/login",
            json={"usuario": "admin@ardlock.local", "senha": "admin"},
        )
        assert res_login.status_code == 200
        jwt_token = res_login.json()["token"]

    headers = {"Authorization": f"Bearer {jwt_token}"}

    # 2. Requisitar endpoint protegido com token -> Sucesso
    with patch("app.auth.dependencies.get_connection", return_value=mock_get_conn_admin(ADMIN_MOCK)), \
         patch("app.api.usuarios.usuario_service.listar_usuarios", return_value=[]):
        res_protegido = client.get("/api/v1/usuarios", headers=headers)
        assert res_protegido.status_code == 200

    # 3. Administrador é desativado no banco
    admin_inativo = (1, "Admin Teste", "admin@ardlock.local", False)
    with patch("app.auth.dependencies.get_connection", return_value=mock_get_conn_admin(admin_inativo)):
        res_apos_desativacao = client.get("/api/v1/usuarios", headers=headers)
        assert res_apos_desativacao.status_code == 401
