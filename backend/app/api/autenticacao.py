from fastapi import APIRouter, Depends, File, UploadFile

from app.auth.dependencies import obter_administrador_atual
from app.schemas.autenticacao_schema import TestarBiometriaResponse
from app.services.autenticacao_service import autenticacao_service

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


@router.post(
    "/testar-biometria",
    response_model=TestarBiometriaResponse,
    deprecated=True,
)
async def testar_biometria(
    file: UploadFile = File(...),
):
    """
    Diagnóstico administrativo legado de biometria 1:N.

    NÃO participa do fluxo de liberação de acesso. O fluxo operacional
    utiliza /arduino/verificar-cartao + /arduino/verificar-face.
    """
    image_bytes = await file.read()
    return await autenticacao_service.testar_biometria(image_bytes)
