from fastapi import APIRouter, Depends, UploadFile, File, Request
from app.auth.dependencies import obter_administrador_atual
from app.services.biometria_service import biometria_service

router = APIRouter(prefix="/biometria", dependencies=[Depends(obter_administrador_atual)])


@router.post("/cadastrar/{usuario_id}")
async def cadastrar_biometria(usuario_id: int, request: Request, admin: dict = Depends(obter_administrador_atual), file: UploadFile = File(...)):
    image_bytes = await file.read()
    return biometria_service.cadastrar_biometria(usuario_id, image_bytes, admin, request)