import os
import re
from datetime import timedelta
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient

# Garante configuração das variáveis de ambiente para execução da suíte de testes
os.environ.setdefault("JWT_SECRET", "super_secret_test_jwt_key_2026_at_least_32_chars_long")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_MINUTES", "60")

from app.auth.security import (
    criar_token_jwt,
    gerar_hash_senha,
    validar_token_jwt,
    verificar_senha,
)
from app.main import app

client = TestClient(app)

ADMIN_HASH_BCRYPT = "$2b$12$aINBb4hKDDfrK3FBd1CpIul9Q3LrB9aT5vceZUbsVBQF8I/aKKlA6"


# 1. Senha correta valida
def test_senha_correta_valida():
    senha = "minha_senha_super_segura_123"
    hash_senha = gerar_hash_senha(senha)
    assert verificar_senha(senha, hash_senha) is True


# 2. Senha incorreta não valida
def test_senha_incorreta_nao_valida():
    senha = "senha_correta"
    hash_senha = gerar_hash_senha(senha)
    assert verificar_senha("senha_errada", hash_senha) is False
    assert verificar_senha("", hash_senha) is False


# 3. Hash armazenado é bcrypt
def test_hash_armazenado_e_bcrypt():
    # Expressão regular para padrão bcrypt ($2a$, $2b$ ou $2y$, custo com 2 dígitos e 53 caracteres base64)
    bcrypt_regex = re.compile(r"^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$")

    # Valida hash de desenvolvimento do administrador inicial
    assert bcrypt_regex.match(ADMIN_HASH_BCRYPT) is not None
    assert len(ADMIN_HASH_BCRYPT) == 60
    assert ADMIN_HASH_BCRYPT.startswith("$2b$")
    assert verificar_senha("admin", ADMIN_HASH_BCRYPT) is True

    # Valida que novas gerações também geram hashes bcrypt válidos
    novo_hash = gerar_hash_senha("outra_senha_segura")
    assert bcrypt_regex.match(novo_hash) is not None
    assert novo_hash.startswith("$2b$")
    assert len(novo_hash) == 60


# 4. Login válido retorna HTTP 200
def test_login_valido_retorna_http_200():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin@ardlock.local", "senha": "admin"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sucesso"] is True
    assert body["usuario"] == "admin@ardlock.local"
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 3600
    assert "token" in body


def test_login_valido_com_alias_admin():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin", "senha": "admin"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sucesso"] is True
    assert body["usuario"] == "admin@ardlock.local"


# 5. Login inválido retorna HTTP 401
def test_login_invalido_senha_errada_retorna_http_401():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin@ardlock.local", "senha": "senha_incorreta"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Usuário ou senha incorretos."}


def test_login_invalido_usuario_inexistente_retorna_http_401():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "inexistente@ardlock.local", "senha": "qualquer_senha"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Usuário ou senha incorretos."}


# 6. Usuário desativado não consegue logar
def test_usuario_desativado_nao_consegue_logar():
    fake_cursor = MagicMock()
    # Simula administrador existente mas inativo (ativo = False)
    fake_cursor.fetchone.return_value = (
        2,
        "Admin Inativo",
        "inativo@ardlock.local",
        ADMIN_HASH_BCRYPT,
        False,
        None,
    )
    fake_connection = MagicMock()
    fake_connection.cursor.return_value.__enter__.return_value = fake_cursor

    with patch("app.auth.service.get_connection") as mock_conn:
        mock_conn.return_value.__enter__.return_value = fake_connection
        response = client.post(
            "/api/v1/auth/login",
            json={"usuario": "inativo@ardlock.local", "senha": "admin"},
        )

    assert response.status_code == 401
    # Mensagem genérica para não revelar existência ou status de desativação
    assert response.json() == {"detail": "Usuário ou senha incorretos."}


# 7. Token retornado é um JWT estruturalmente válido
def test_token_retornado_e_jwt_estruturalmente_valido():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin@ardlock.local", "senha": "admin"},
    )
    assert response.status_code == 200
    token = response.json()["token"]

    # Deve possuir exatamente 3 partes separadas por '.' (header.payload.signature)
    partes = token.split(".")
    assert len(partes) == 3

    # Validação e decodificação estrutural
    payload = validar_token_jwt(token)
    assert isinstance(payload, dict)


# 8. JWT possui "sub"
def test_jwt_possui_sub():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin@ardlock.local", "senha": "admin"},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    payload = validar_token_jwt(token)
    assert "sub" in payload
    assert payload["sub"] == "1"


# 9. JWT possui "exp"
def test_jwt_possui_exp():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin@ardlock.local", "senha": "admin"},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    payload = validar_token_jwt(token)
    assert "exp" in payload
    assert isinstance(payload["exp"], int)
    assert payload["exp"] > payload["iat"]


# 10. JWT possui "iat"
def test_jwt_possui_iat():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin@ardlock.local", "senha": "admin"},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    payload = validar_token_jwt(token)
    assert "iat" in payload
    assert isinstance(payload["iat"], int)


# 11. JWT não é o antigo "secrets.token_urlsafe"
def test_jwt_nao_e_antigo_token_urlsafe():
    response = client.post(
        "/api/v1/auth/login",
        json={"usuario": "admin@ardlock.local", "senha": "admin"},
    )
    assert response.status_code == 200
    token = response.json()["token"]

    # token_urlsafe(32) é uma string uniforme de 43 caracteres sem pontos
    assert "." in token
    assert token.count(".") == 2

    header = jwt.get_unverified_header(token)
    assert header.get("alg") == "HS256"
    assert header.get("typ") == "JWT"


# 12. Token expirado deve ser rejeitado pela função de validação JWT
def test_token_expirado_rejeitado_pela_validacao_jwt():
    token_expirado = criar_token_jwt(
        sub="1",
        email="admin@ardlock.local",
        expires_delta=timedelta(seconds=-10),
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        validar_token_jwt(token_expirado)


def test_token_adulterado_rejeitado_pela_validacao_jwt():
    token = criar_token_jwt(sub="1", email="admin@ardlock.local")
    partes = token.split(".")
    token_adulterado = f"{partes[0]}.{partes[1]}.assinatura_falsificada"

    with pytest.raises(jwt.InvalidTokenError):
        validar_token_jwt(token_adulterado)


def test_login_com_payload_incompleto():
    response = client.post("/api/v1/auth/login", json={"usuario": "admin@ardlock.local"})
    assert response.status_code == 422