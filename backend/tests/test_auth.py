from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_login_com_credenciais_validas():
    response = client.post(
        "/api/auth/login",
        json={"usuario": "admin", "senha": "admin"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["sucesso"] is True
    assert body["usuario"] == "admin"
    assert body["token"]


def test_login_com_credenciais_invalidas():
    response = client.post(
        "/api/auth/login",
        json={"usuario": "admin", "senha": "incorreta"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Usuário ou senha incorretos."}


def test_login_com_payload_incompleto():
    response = client.post("/api/auth/login", json={"usuario": "admin"})

    assert response.status_code == 422