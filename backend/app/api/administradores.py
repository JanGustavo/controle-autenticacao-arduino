from typing import Any
from fastapi import APIRouter, Depends, status

from app.auth.dependencies import obter_administrador_atual
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
def criar_administrador(admin: AdministradorCreate):
    return administrador_service.criar_administrador(admin)


@router.patch("/administradores/{admin_id}", response_model=AdministradorResponse)
def atualizar_administrador(admin_id: int, admin: AdministradorUpdate):
    return administrador_service.atualizar_administrador(admin_id, admin)


@router.delete("/administradores/{admin_id}")
def deletar_administrador(
    admin_id: int,
    admin_autenticado: dict[str, Any] = Depends(obter_administrador_atual),
):
    return administrador_service.deletar_administrador(
        admin_id=admin_id,
        admin_autenticado_id=admin_autenticado["admin_id"],
        admin_autenticado_principal=admin_autenticado.get("principal", False),
    )

