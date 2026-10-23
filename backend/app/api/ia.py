import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.auth.dependencies import obter_administrador_atual
from app.services.ia_service import responder_com_groq, resumo_acessos, validar_pergunta
from app.services.ia_history import (
    apagar_resposta, atualizar_resposta, buscar_resposta, listar_historico, salvar_resposta,
)


router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


class PerguntaIA(BaseModel):
    pergunta: str = Field(min_length=3, max_length=500)


@router.get("/resumo")
def obter_resumo():
    return resumo_acessos()


@router.get("/historico")
def obter_historico(admin: dict = Depends(obter_administrador_atual)):
    return listar_historico(admin["admin_id"])


@router.delete("/historico/{item_id}", status_code=204)
def excluir_resposta(item_id: int, admin: dict = Depends(obter_administrador_atual)):
    if not apagar_resposta(admin["admin_id"], item_id):
        raise HTTPException(status_code=404, detail="Resposta não encontrada.")


@router.post("/perguntar")
async def perguntar(body: PerguntaIA, admin: dict = Depends(obter_administrador_atual)):
    _validar_pergunta(body.pergunta)
    resumo = await run_in_threadpool(resumo_acessos)
    resposta = await _gerar_resposta(body.pergunta)
    item = await run_in_threadpool(salvar_resposta, admin["admin_id"], body.pergunta, resposta)
    return {"resposta": resposta, "resumo": resumo, "item": item}


@router.post("/historico/{item_id}/atualizar")
async def atualizar_consulta(item_id: int, admin: dict = Depends(obter_administrador_atual)):
    item = await run_in_threadpool(buscar_resposta, admin["admin_id"], item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Resposta não encontrada.")
    _validar_pergunta(item["pergunta"])
    resposta = await _gerar_resposta(item["pergunta"])
    atualizado = await run_in_threadpool(atualizar_resposta, admin["admin_id"], item_id, resposta)
    if atualizado is None:
        raise HTTPException(status_code=404, detail="Resposta não encontrada.")
    resumo = await run_in_threadpool(resumo_acessos)
    return {"resposta": resposta, "resumo": resumo, "item": atualizado}


def _validar_pergunta(pergunta: str) -> None:
    try:
        validar_pergunta(pergunta)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


async def _gerar_resposta(pergunta: str) -> str:
    try:
        return await responder_com_groq(pergunta)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 429:
            raise HTTPException(status_code=429, detail="Limite da Groq atingido. Tente novamente depois.") from error
        raise HTTPException(status_code=502, detail="A Groq não conseguiu responder agora.") from error
    except (httpx.HTTPError, KeyError, IndexError, TypeError, AttributeError, ValueError) as error:
        raise HTTPException(status_code=502, detail="Falha ao consultar a Groq.") from error
