from fastapi import APIRouter

from app.schemas.historico_acesso_schema import HistoricoAcessoCreate, HistoricoAcessoResponse
from app.services.historico_acesso_service import historico_acesso_service

router = APIRouter()


@router.post("/historico-acesso", response_model=HistoricoAcessoResponse, status_code=201)
def criar_historico(registro: HistoricoAcessoCreate):
    return historico_acesso_service.criar_historico(registro)

@router.get("/historico-acesso", response_model=list[HistoricoAcessoResponse])
def listar_historico(
    q: str | None = None,
    usuario_id: int | None = None,
    local_id: int | None = None,
    autorizado: bool | None = None,
):
    return historico_acesso_service.listar_historico(
        q=q, usuario_id=usuario_id, local_id=local_id, autorizado=autorizado
    )


@router.get("/historico-acesso/{historico_id}", response_model=HistoricoAcessoResponse)
def obter_historico(historico_id: int):
    return historico_acesso_service.obter_historico(historico_id)