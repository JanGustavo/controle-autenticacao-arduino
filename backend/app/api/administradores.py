from typing import Any
from fastapi import APIRouter, Depends, status, Request

from app.auth.dependencies import obter_administrador_atual
from app.services.audit_service import audit_service
from app.schemas.administrador_schema import (
    AdministradorCreate,
    AdministradorResponse,
    AdministradorUpdate,
)
from app.services.administrador_service import administrador_service

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


@router.get("/administradores", response_model=list[AdministradorResponse])
def listar_administradores(q: str | None = None, ativo: bool | None = None):
    return administrador_service.listar_administradores(q=q, ativo=ativo)


@router.get("/administradores/{admin_id}", response_model=AdministradorResponse)
def obter_administrador(admin_id: int):
    return administrador_service.obter_administrador(admin_id)


@router.post("/administradores", response_model=AdministradorResponse, status_code=status.HTTP_201_CREATED)
def criar_administrador(admin: AdministradorCreate, request: Request, admin_auth: dict = Depends(obter_administrador_atual)):
    resultado = administrador_service.criar_administrador(admin)
    audit_service.registrar(
        action="CREATE_ADMIN",
        admin_id=admin_auth.get("admin_id"),
        resource_type="ADMIN",
        resource_id=resultado["admin_id"],
        description=f"Administrador {admin.nome} criado",
        request=request
    )
    return resultado


@router.patch("/administradores/{admin_id}", response_model=AdministradorResponse)
def atualizar_administrador(admin_id: int, admin: AdministradorUpdate, request: Request, admin_auth: dict = Depends(obter_administrador_atual)):
    resultado = administrador_service.atualizar_administrador(admin_id, admin)
    audit_service.registrar(
        action="UPDATE_ADMIN",
        admin_id=admin_auth.get("admin_id"),
        resource_type="ADMIN",
        resource_id=admin_id,
        description=f"Administrador {admin_id} atualizado",
        request=request
    )
    return resultado


@router.delete("/administradores/{admin_id}")
def deletar_administrador(
    admin_id: int,
    request: Request,
    admin_autenticado: dict[str, Any] = Depends(obter_administrador_atual),
):
    resultado = administrador_service.deletar_administrador(
        admin_id=admin_id,
        admin_autenticado_id=admin_autenticado["admin_id"],
        admin_autenticado_principal=admin_autenticado.get("principal", False),
    )
    audit_service.registrar(
        action="DELETE_ADMIN",
        admin_id=admin_autenticado["admin_id"],
        resource_type="ADMIN",
        resource_id=admin_id,
        description=f"Administrador {admin_id} excluído",
        request=request
    )
    return resultado

