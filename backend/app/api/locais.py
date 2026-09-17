from fastapi import APIRouter

from app.schemas.local_schema import LocalCreate, LocalResponse, LocalUpdate
from app.services.local_service import local_service

router = APIRouter()


@router.get("/locais", response_model=list[LocalResponse])
def listar_locais(q: str | None = None, ativo: bool | None = None):
    return local_service.listar_locais(q=q, ativo=ativo)


@router.get("/locais/{local_id}", response_model=LocalResponse)
def obter_local(local_id: int):
    return local_service.obter_local(local_id)


@router.post("/locais", response_model=LocalResponse, status_code=201)
def criar_local(local: LocalCreate):
    return local_service.criar_local(local)


@router.patch("/locais/{local_id}", response_model=LocalResponse)
def atualizar_local(local_id: int, local: LocalUpdate):
    return local_service.atualizar_local(local_id, local)


@router.delete("/locais/{local_id}")
def deletar_local(local_id: int):
    return local_service.deletar_local(local_id)
