from fastapi import APIRouter, Depends, Request

from app.auth.dependencies import obter_administrador_atual
from app.schemas.local_schema import LocalCreate, LocalResponse, LocalUpdate
from app.services.local_service import local_service
from app.services.audit_service import audit_service

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])



@router.get("/locais", response_model=list[LocalResponse])
def listar_locais(q: str | None = None, ativo: bool | None = None):
    return local_service.listar_locais(q=q, ativo=ativo)


@router.get("/locais/{local_id}", response_model=LocalResponse)
def obter_local(local_id: int):
    return local_service.obter_local(local_id)


@router.post("/locais", response_model=LocalResponse, status_code=201)
def criar_local(local: LocalCreate, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = local_service.criar_local(local)
    audit_service.registrar(
        action="CREATE_LOCAL",
        admin_id=admin.get("admin_id"),
        resource_type="LOCAL",
        resource_id=resultado["local_id"],
        description=f"Local {local.nome} criado",
        request=request
    )
    return resultado


@router.patch("/locais/{local_id}", response_model=LocalResponse)
def atualizar_local(local_id: int, local: LocalUpdate, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = local_service.atualizar_local(local_id, local)
    audit_service.registrar(
        action="UPDATE_LOCAL",
        admin_id=admin.get("admin_id"),
        resource_type="LOCAL",
        resource_id=local_id,
        description=f"Local {local_id} atualizado",
        request=request
    )
    return resultado


@router.delete("/locais/{local_id}")
def deletar_local(local_id: int, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = local_service.deletar_local(local_id)
    audit_service.registrar(
        action="DELETE_LOCAL",
        admin_id=admin.get("admin_id"),
        resource_type="LOCAL",
        resource_id=local_id,
        description=f"Local {local_id} excluído",
        request=request
    )
    return resultado
