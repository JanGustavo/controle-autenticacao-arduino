import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.usuario_schema import UsuarioCreate, UsuarioUpdate
from app.services.usuario_service import UsuarioService


def test_tipo_usuario_aceita_interno_e_visitante():
    interno = UsuarioCreate(nome="Maria", tipo_usuario="INTERNO")
    visitante = UsuarioCreate(nome="João", tipo_usuario="VISITANTE")

    assert interno.tipo_usuario == "INTERNO"
    assert visitante.tipo_usuario == "VISITANTE"


def test_tipo_usuario_rejeita_valor_fora_do_enum():
    with pytest.raises(ValidationError):
        UsuarioCreate(nome="Maria", tipo_usuario="TERCEIRIZADO")


def test_tipo_usuario_default_preserva_compatibilidade():
    usuario = UsuarioCreate(nome="Maria")
    assert usuario.tipo_usuario == "INTERNO"


def test_cpf_opcional_e_normalizado_para_11_digitos():
    assert UsuarioService._normalizar_cpf(None) is None
    assert UsuarioService._normalizar_cpf("") is None
    assert UsuarioService._normalizar_cpf("123.456.789-01") == "12345678901"


def test_cpf_com_quantidade_invalida_de_digitos_rejeitado():
    with pytest.raises(HTTPException) as exc:
        UsuarioService._normalizar_cpf("123.456")

    assert exc.value.status_code == 422
    assert "11 dígitos" in exc.value.detail


def test_update_permite_cpf_tipo_e_status_sem_rfid():
    update = UsuarioUpdate(
        cpf="123.456.789-01",
        tipo_usuario="VISITANTE",
        ativo=True,
    )

    assert update.model_dump(exclude_unset=True) == {
        "cpf": "123.456.789-01",
        "tipo_usuario": "VISITANTE",
        "ativo": True,
    }
