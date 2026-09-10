from datetime import datetime
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)

USUARIO = {
	"user_id": 1,
	"nome": "Maria Silva",
	"uid_card": "RFID-001",
	"vetor_facial": [0.1, 0.2, 0.3],
	"ativo": True,
	"criado_em": datetime(2026, 9, 10, 12, 0, 0).isoformat(),
}


def test_listar_usuarios():
	with patch("app.api.usuarios.usuario_service.listar_usuarios", return_value=[USUARIO]) as listar:
		response = client.get("/api/v1/usuarios")

	assert response.status_code == 200
	assert response.json() == [USUARIO]
	listar.assert_called_once_with()


def test_obter_usuario():
	with patch("app.api.usuarios.usuario_service.obter_usuario", return_value=USUARIO) as obter:
		response = client.get("/api/v1/usuarios/1")

	assert response.status_code == 200
	assert response.json() == USUARIO
	obter.assert_called_once_with(1)


def test_criar_usuario():
	payload = {
		"nome": "Maria Silva",
		"uid_card": "RFID-001",
		"vetor_facial": [0.1, 0.2, 0.3],
		"ativo": True,
		"permissoes": [],
	}

	with patch("app.api.usuarios.usuario_service.criar_usuario", return_value=USUARIO) as criar:
		response = client.post("/api/v1/usuarios", json=payload)

	assert response.status_code == 200
	assert response.json() == USUARIO
	criar.assert_called_once()
	assert criar.call_args.args[0].model_dump() == payload


def test_atualizar_usuario():
	payload = {"nome": "Maria Souza", "ativo": False}
	usuario_atualizado = {**USUARIO, "nome": "Maria Souza", "ativo": False}

	with patch(
		"app.api.usuarios.usuario_service.atualizar_usuario",
		return_value=usuario_atualizado,
	) as atualizar:
		response = client.patch("/api/v1/usuarios/1", json=payload)

	assert response.status_code == 200
	assert response.json() == usuario_atualizado
	atualizar.assert_called_once()
	assert atualizar.call_args.args[0] == 1
	assert atualizar.call_args.args[1].model_dump(exclude_unset=True) == payload


def test_deletar_usuario():
	with patch(
		"app.api.usuarios.usuario_service.deletar_usuario",
		return_value={"mensagem": "Usuário excluído com sucesso."},
	) as deletar:
		response = client.delete("/api/v1/usuarios/1")

	assert response.status_code == 200
	assert response.json() == {"mensagem": "Usuário excluído com sucesso."}
	deletar.assert_called_once_with(1)
