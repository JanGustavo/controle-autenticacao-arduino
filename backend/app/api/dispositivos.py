from fastapi import APIRouter, Depends, Request

from app.auth.dependencies import obter_administrador_atual
from app.schemas.dispositivo_schema import (
    DispositivoCreate,
    DispositivoResponse,
    DispositivoSimplesResponse,
    DispositivoUpdate,
)
from app.services.audit_service import audit_service
from app.services.dispositivo_service import dispositivo_service

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


@router.get("/dispositivos", response_model=list[DispositivoResponse])
def listar_dispositivos(
    q: str | None = None,
    local_id: int | None = None,
    ativo: bool | None = None,
):
    return dispositivo_service.listar_dispositivos(
        q=q,
        local_id=local_id,
        ativo=ativo,
    )


@router.get(
    "/dispositivos/simples",
    response_model=list[DispositivoSimplesResponse],
    summary="Listar dispositivos leves para dropdowns",
)
def listar_dispositivos_simples(
    q: str | None = None,
    ativo: bool | None = None,
):
    """Lista dispositivos sem JOIN com local (para dropdowns/seletores)."""
    return dispositivo_service.listar_dispositivos_simples(q=q, ativo=ativo)


@router.get("/dispositivos/{dispositivo_id}", response_model=DispositivoResponse)
def obter_dispositivo(dispositivo_id: int):
    return dispositivo_service.obter_dispositivo(dispositivo_id)


@router.post("/dispositivos", response_model=DispositivoResponse, status_code=201)
def criar_dispositivo(
    dispositivo: DispositivoCreate,
    request: Request,
    admin: dict = Depends(obter_administrador_atual),
):
    resultado = dispositivo_service.criar_dispositivo(dispositivo)
    audit_service.registrar(
        action="CREATE_DEVICE",
        admin_id=admin.get("admin_id"),
        resource_type="DEVICE",
        resource_id=resultado["dispositivo_id"],
        description=f"Dispositivo {dispositivo.identificador} criado",
        request=request,
    )
    return resultado


@router.patch("/dispositivos/{dispositivo_id}", response_model=DispositivoResponse)
def atualizar_dispositivo(
    dispositivo_id: int,
    dispositivo: DispositivoUpdate,
    request: Request,
    admin: dict = Depends(obter_administrador_atual),
):
    resultado = dispositivo_service.atualizar_dispositivo(
        dispositivo_id,
        dispositivo,
    )
    audit_service.registrar(
        action="UPDATE_DEVICE",
        admin_id=admin.get("admin_id"),
        resource_type="DEVICE",
        resource_id=dispositivo_id,
        description=f"Dispositivo {dispositivo_id} atualizado",
        request=request,
    )
    return resultado


@router.delete("/dispositivos/{dispositivo_id}")
def deletar_dispositivo(
    dispositivo_id: int,
    request: Request,
    admin: dict = Depends(obter_administrador_atual),
):
    resultado = dispositivo_service.deletar_dispositivo(dispositivo_id)
    audit_service.registrar(
        action="DELETE_DEVICE",
        admin_id=admin.get("admin_id"),
        resource_type="DEVICE",
        resource_id=dispositivo_id,
        description=f"Dispositivo {dispositivo_id} excluído",
        request=request,
    )
    return resultado
