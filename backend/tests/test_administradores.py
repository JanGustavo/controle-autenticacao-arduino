from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.auth.security import criar_token_jwt, verificar_senha
from app.main import app

client = TestClient(app)

ADMIN_PRINCIPAL = (1, "Administrador Principal", "admin@ardlock.local", True, True, datetime.now())
ADMIN_COMUM = (2, "Admin Secundario", "secundario@ardlock.local", True, False, datetime.now())



def auth_headers(admin_id: int = 1):
    token = criar_token_jwt(sub=str(admin_id), email="admin@ardlock.local")
    return {"Authorization": f"Bearer {token}"}


def mock_connection(fetchone_return=ADMIN_PRINCIPAL, fetchall_return=None):
    fake_cursor = MagicMock()
    fake_cursor.fetchone.return_value = fetchone_return
    if fetchall_return is not None:
        fake_cursor.fetchall.return_value = fetchall_return
    fake_connection = MagicMock()
    fake_connection.cursor.return_value.__enter__.return_value = fake_cursor

    class MockContextManager:
        def __enter__(self):
            return fake_connection
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    return MockContextManager()


# 1. Requisição sem JWT -> 401
def test_crud_administradores_sem_jwt_retorna_401():
    assert client.get("/api/v1/administradores").status_code == 401
    assert client.get("/api/v1/administradores/1").status_code == 401
    assert client.post("/api/v1/administradores", json={}).status_code == 401
    assert client.patch("/api/v1/administradores/1", json={}).status_code == 401
    assert client.delete("/api/v1/administradores/1").status_code == 401


# 2. Listar e Consultar Administradores
def test_listar_administradores_autenticado():
    rows = [
        (1, "Admin Principal", "admin@ardlock.local", True, True, datetime(2026, 1, 1)),
        (2, "Admin Secundario", "secundario@ardlock.local", True, False, datetime(2026, 1, 2)),
    ]
    with patch("app.services.administrador_service.get_connection", return_value=mock_connection(fetchall_return=rows)):
        response = client.get("/api/v1/administradores", headers=auth_headers())

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["email"] == "admin@ardlock.local"
    assert data[0]["principal"] is True
    assert data[1]["principal"] is False


def test_obter_administrador_por_id():
    row = (2, "Admin Secundario", "secundario@ardlock.local", True, False, datetime(2026, 1, 2))
    with patch("app.services.administrador_service.get_connection", return_value=mock_connection(fetchone_return=row)):
        response = client.get("/api/v1/administradores/2", headers=auth_headers())

    assert response.status_code == 200
    data = response.json()
    assert data["admin_id"] == 2
    assert data["email"] == "secundario@ardlock.local"


# 3. Criar Administrador
def test_criar_administrador_valido():
    novo_admin = (3, "Novo Admin", "novo@ardlock.local", True, False, datetime(2026, 9, 16))
    payload = {
        "nome": "Novo Admin",
        "email": "novo@ardlock.local",
        "senha": "senha_segura_123",
        "ativo": True,
    }

    with patch("app.services.administrador_service.get_connection") as mock_conn:
        fake_cursor = MagicMock()
        fake_cursor.fetchone.return_value = novo_admin
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = fake_cursor

        response = client.post("/api/v1/administradores", json=payload, headers=auth_headers())

        assert response.status_code == 201
        data = response.json()
        assert data["admin_id"] == 3
        assert data["email"] == "novo@ardlock.local"
        assert data["principal"] is False
        # Garante que a senha / hash NÃO aparece na resposta da API
        assert "senha" not in data
        assert "senha_hash" not in data

        # Verifica se a senha gravada no INSERT foi transformada em hash bcrypt
        args, _ = fake_cursor.execute.call_args
        sql_inserted_hash = args[1][2]
        assert sql_inserted_hash.startswith("$2b$")
        assert verificar_senha("senha_segura_123", sql_inserted_hash) is True


# 4. Atualização
def test_atualizar_nome_e_email_administrador():
    admin_atualizado = (2, "Nome Editado", "novoemail@ardlock.local", True, False, datetime(2026, 1, 2))
    with patch("app.services.administrador_service.get_connection") as mock_conn:
        fake_cursor = MagicMock()
        fake_cursor.fetchone.side_effect = [ADMIN_COMUM, admin_atualizado]
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = fake_cursor

        response = client.patch(
            "/api/v1/administradores/2",
            json={"nome": "Nome Editado", "email": "novoemail@ardlock.local"},
            headers=auth_headers(),
        )

        assert response.status_code == 200
        assert response.json()["nome"] == "Nome Editado"
        assert response.json()["email"] == "novoemail@ardlock.local"


def test_impedir_desativacao_da_conta_principal():
    with patch("app.services.administrador_service.get_connection", return_value=mock_connection(fetchone_return=ADMIN_PRINCIPAL)):
        response = client.patch(
            "/api/v1/administradores/1",
            json={"ativo": False},
            headers=auth_headers(),
        )

    assert response.status_code == 400
    assert "conta administrativa principal não pode ser desativada" in response.json()["detail"]


# 5. Exclusão e Regras de Segurança
def test_excluir_administrador_comum():
    with patch("app.services.administrador_service.get_connection") as mock_conn:
        fake_cursor = MagicMock()
        # 1: busca o admin alvo (comum); 2: conta total de ativos (>1); 3: delete returning
        fake_cursor.fetchone.side_effect = [ADMIN_COMUM, (3,), (2,)]
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = fake_cursor

        # Admin ID 1 exclui o Admin ID 2
        response = client.delete("/api/v1/administradores/2", headers=auth_headers(admin_id=1))

        assert response.status_code == 200
        assert response.json() == {"mensagem": "Administrador excluído com sucesso."}


def test_impedir_exclusao_da_conta_principal():
    with patch("app.services.administrador_service.get_connection", return_value=mock_connection(fetchone_return=ADMIN_PRINCIPAL)):
        response = client.delete("/api/v1/administradores/1", headers=auth_headers(admin_id=2))

    assert response.status_code == 409
    assert "conta administrativa principal do ArdLock não pode ser excluída" in response.json()["detail"]


def test_impedir_autoexclusao():
    with patch("app.auth.dependencies.get_connection") as mock_auth_conn, \
         patch("app.services.administrador_service.get_connection") as mock_srv_conn:

        # Mock da dependência de auth para retornar admin_id = 2
        fake_auth_cursor = MagicMock()
        fake_auth_cursor.fetchone.return_value = (2, "Admin Secundario", "secundario@ardlock.local", True)
        mock_auth_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = fake_auth_cursor

        # Mock do service para retornar ADMIN_COMUM (admin_id = 2)
        fake_srv_cursor = MagicMock()
        fake_srv_cursor.fetchone.return_value = ADMIN_COMUM
        mock_srv_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = fake_srv_cursor

        # Admin ID 2 tenta excluir a si próprio
        response = client.delete("/api/v1/administradores/2", headers=auth_headers(admin_id=2))

    assert response.status_code == 400
    assert "Não é permitido excluir a própria conta logada" in response.json()["detail"]



def test_impedir_exclusao_que_deixe_sistema_sem_administrador():
    with patch("app.services.administrador_service.get_connection") as mock_conn:
        fake_cursor = MagicMock()
        # Admin comum, mas total de ativos no sistema é 1
        fake_cursor.fetchone.side_effect = [ADMIN_COMUM, (1,)]
        mock_conn.return_value.__enter__.return_value.cursor.return_value.__enter__.return_value = fake_cursor

        response = client.delete("/api/v1/administradores/2", headers=auth_headers(admin_id=1))

        assert response.status_code == 400
        assert "Não é possível excluir o único administrador ativo do sistema" in response.json()["detail"]
