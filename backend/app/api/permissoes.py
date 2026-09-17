from fastapi import APIRouter

from app.schemas.permissao_schema import PermissaoCreate, PermissaoResponse, PermissaoUpdate
from app.services.permissao_service import permissao_service

router = APIRouter()

@router.get("/permissoes", response_model=list[PermissaoResponse])
def listar_permissoes(q: str | None = None, usuario_id: int | None = None, local_id: int | None = None):
    return permissao_service.listar_permissoes(q=q, usuario_id=usuario_id, local_id=local_id)


@router.get("/permissoes/{permissao_id}", response_model=PermissaoResponse)
def obter_permissao(permissao_id: int):
    return permissao_service.obter_permissao(permissao_id)

@router.post("/permissoes", response_model=PermissaoResponse)
def criar_permissao(permissao: PermissaoCreate):
    return permissao_service.criar_permissao(permissao)

@router.delete("/permissoes/{permissao_id}")
def deletar_permissao(permissao_id: int):
    return permissao_service.deletar_permissao(permissao_id)

@router.patch("/permissoes/{permissao_id}", response_model=PermissaoResponse)
def atualizar_permissao(permissao_id: int, permissao: PermissaoUpdate):
    return permissao_service.atualizar_permissao(permissao_id, permissao)