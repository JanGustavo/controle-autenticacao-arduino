from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.auth.dependencies import obter_administrador_atual
from app.services.audit_service import audit_service
from app.services.biometria_service import biometria_service

router = APIRouter(
    prefix="/biometria",
    dependencies=[Depends(obter_administrador_atual)],
)


@router.post("/cadastrar/{usuario_id}")
async def cadastrar_biometria(
    usuario_id: int,
    request: Request,
    admin: dict = Depends(obter_administrador_atual),
    file: UploadFile = File(...),
):
    image_bytes = await file.read()
    resultado = biometria_service.cadastrar_biometria(usuario_id, image_bytes)

    audit_service.registrar(
        action="UPDATE_BIOMETRICS",
        admin_id=admin.get("admin_id"),
        resource_type="USER_BIOMETRICS",
        resource_id=usuario_id,
        description=f"Biometria facial cadastrada para usuário {usuario_id}",
        request=request,
    )

    return resultado
