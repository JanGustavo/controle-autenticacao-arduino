from fastapi import APIRouter

from app.schemas.usuario_schema import UsuarioCreate, UsuarioResponse, UsuarioUpdate
from app.services.usuario_service import usuario_service

router = APIRouter()

@router.get("/usuarios", response_model=list[UsuarioResponse])
def listar_usuarios(q: str | None = None, ativo: bool | None = None):
    return usuario_service.listar_usuarios(q=q, ativo=ativo)


@router.get("/usuarios/{usuario_id}", response_model=UsuarioResponse)
def obter_usuario(usuario_id: int):
    return usuario_service.obter_usuario(usuario_id)

@router.post("/usuarios", response_model=UsuarioResponse)
def criar_usuario(usuario: UsuarioCreate):
    return usuario_service.criar_usuario(usuario)

@router.delete("/usuarios/{usuario_id}")
def deletar_usuario(usuario_id: int):
    return usuario_service.deletar_usuario(usuario_id)

@router.patch("/usuarios/{usuario_id}", response_model=UsuarioResponse)
def atualizar_usuario(usuario_id: int, usuario: UsuarioUpdate):
    return usuario_service.atualizar_usuario(usuario_id, usuario)