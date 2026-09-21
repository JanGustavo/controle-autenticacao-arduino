from fastapi import APIRouter, UploadFile, File
from app.services.autenticacao_service import autenticacao_service
from app.schemas.autenticacao_schema import TestarBiometriaResponse

router = APIRouter()

@router.post("/testar-biometria", response_model=TestarBiometriaResponse)
async def testar_biometria(
    file: UploadFile = File(...)
):
    image_bytes = await file.read()
    return await autenticacao_service.testar_biometria(image_bytes)