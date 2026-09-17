from fastapi import APIRouter, Depends, Request

from app.auth.dependencies import obter_administrador_atual
from app.schemas.permissao_schema import PermissaoCreate, PermissaoResponse, PermissaoUpdate
from app.services.permissao_service import permissao_service
from app.services.audit_service import audit_service

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


@router.get("/permissoes", response_model=list[PermissaoResponse])
def listar_permissoes(q: str | None = None, usuario_id: int | None = None, local_id: int | None = None):
    return permissao_service.listar_permissoes(q=q, usuario_id=usuario_id, local_id=local_id)


@router.get("/permissoes/{permissao_id}", response_model=PermissaoResponse)
def obter_permissao(permissao_id: int):
    return permissao_service.obter_permissao(permissao_id)

@router.post("/permissoes", response_model=PermissaoResponse)
def criar_permissao(permissao: PermissaoCreate, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = permissao_service.criar_permissao(permissao)
    audit_service.registrar(
        action="CREATE_PERMISSION",
        admin_id=admin.get("admin_id"),
        resource_type="PERMISSION",
        resource_id=resultado["permissao_id"],
        description=f"Permissão concedida para usuário {permissao.usuario_id} no local {permissao.local_id}",
        request=request
    )
    return resultado

@router.delete("/permissoes/{permissao_id}")
def deletar_permissao(permissao_id: int, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = permissao_service.deletar_permissao(permissao_id)
    audit_service.registrar(
        action="DELETE_PERMISSION",
        admin_id=admin.get("admin_id"),
        resource_type="PERMISSION",
        resource_id=permissao_id,
        description=f"Permissão {permissao_id} excluída",
        request=request
    )
    return resultado

@router.patch("/permissoes/{permissao_id}", response_model=PermissaoResponse)
def atualizar_permissao(permissao_id: int, permissao: PermissaoUpdate, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = permissao_service.atualizar_permissao(permissao_id, permissao)
    audit_service.registrar(
        action="UPDATE_PERMISSION",
        admin_id=admin.get("admin_id"),
        resource_type="PERMISSION",
        resource_id=permissao_id,
        description=f"Permissão {permissao_id} atualizada",
        request=request
    )
    return resultado