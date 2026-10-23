import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.auth.dependencies import obter_administrador_atual
from app.services.ia_service import responder_com_groq, resumo_acessos


router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


class PerguntaIA(BaseModel):
    pergunta: str = Field(min_length=3, max_length=500)


@router.get("/resumo")
def obter_resumo():
    return resumo_acessos()


@router.post("/perguntar")
async def perguntar(body: PerguntaIA):
    resumo = await run_in_threadpool(resumo_acessos)
    try:
        resposta = await responder_com_groq(body.pergunta)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 429:
            raise HTTPException(status_code=429, detail="Limite da Groq atingido. Tente novamente depois.") from error
        raise HTTPException(status_code=502, detail="A Groq não conseguiu responder agora.") from error
    except (httpx.HTTPError, KeyError, IndexError, TypeError, AttributeError, ValueError) as error:
        raise HTTPException(status_code=502, detail="Falha ao consultar a Groq.") from error
    return {"resposta": resposta, "resumo": resumo}
