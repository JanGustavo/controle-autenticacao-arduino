from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_listar_planos():
    response = client.get("/api/v1/planos")
    assert response.status_code == 200
    planos = response.json()
    assert len(planos) == 4

    ids = [p["id"] for p in planos]
    assert ids == ["basico", "intermediario", "premium", "personalizado"]

    # Plano 1: Básico (1 dispositivo, 50 usuários)
    p1 = planos[0]
    assert p1["dispositivos"] == 1
    assert p1["usuarios"] == 50
    assert p1["destaque"] is False

    # Plano 2: Intermediário (decoy, 4 dispositivos)
    p2 = planos[1]
    assert p2["dispositivos"] == 4
    assert p2["decoy"] is True

    # Plano 3: Premium (7 dispositivos, destaque, suporte prioritário presencial)
    p3 = planos[2]
    assert p3["dispositivos"] == 7
    assert p3["destaque"] is True

    # Plano 4: Personalizado (e-mail janderson.gustavo1@gmail.com)
    p4 = planos[3]
    assert p4["email_contato"] == "janderson.gustavo1@gmail.com"


def test_validar_transacao_sucesso():
    payload = {
        "plano_id": "premium",
        "nome_organizacao": "Acme Corp",
        "email_gestor": "gestor@acme.com",
        "forma_pagamento": "cartao",
        "valor_esperado": 389.00,
    }
    response = client.post("/api/v1/planos/validar-transacao", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["sucesso"] is True
    assert res["plano_id"] == "premium"
    assert "ARD-" in res["codigo_transacao"]
    assert res["valor_cobrado"] == 389.00


def test_validar_transacao_valor_invalido():
    payload = {
        "plano_id": "premium",
        "nome_organizacao": "Acme Corp",
        "email_gestor": "gestor@acme.com",
        "forma_pagamento": "cartao",
        "valor_esperado": 10.00,  # Valor divergente do plano (389.00)
    }
    response = client.post("/api/v1/planos/validar-transacao", json=payload)
    assert response.status_code == 422
    assert "Inconsistência de valor" in response.json()["detail"]


def test_validar_transacao_personalizado_requer_email():
    payload = {
        "plano_id": "personalizado",
        "nome_organizacao": "Acme Corp",
        "email_gestor": "gestor@acme.com",
        "forma_pagamento": "faturado",
        "valor_esperado": 0.0,
    }
    response = client.post("/api/v1/planos/validar-transacao", json=payload)
    assert response.status_code == 400
    assert "janderson.gustavo1@gmail.com" in response.json()["detail"]
