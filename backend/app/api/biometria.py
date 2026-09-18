from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from app.auth.dependencies import obter_administrador_atual
from app.services.face_service import FaceService
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/biometria", dependencies=[Depends(obter_administrador_atual)])


@router.post("/cadastrar/{usuario_id}")
async def cadastrar_biometria(usuario_id: int, file: UploadFile = File(...)):
    image_bytes = await file.read()
    
    # 1. Extrai o vetor
    vector = FaceService.extract_face_vector(image_bytes)
    if not vector:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum rosto identificado na imagem enviada."
        )

    # 2. Salva o vetor no banco de dados como JSONB.
    UsuarioService().atualizar_vetor_facial(usuario_id, vector)

    return {"message": "Vetor biométrico cadastrado com sucesso!", "vector_length": len(vector)}