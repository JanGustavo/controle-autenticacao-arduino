from fastapi import HTTPException, status, Request
from app.services.face_service import FaceService
from app.services.usuario_service import usuario_service
from app.services.audit_service import audit_service

class BiometriaService:
    @staticmethod
    def cadastrar_biometria(usuario_id: int, image_bytes: bytes, admin: dict, request: Request) -> dict:
        # 1. Extrai o vetor
        vector = FaceService.extract_face_vector(image_bytes)
        if not vector:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum rosto identificado na imagem enviada."
            )

        # 2. Salva o vetor no banco de dados como JSONB.
        usuario_service.atualizar_vetor_facial(usuario_id, vector)
        
        audit_service.registrar(
            action="UPDATE_BIOMETRICS",
            admin_id=admin.get("admin_id"),
            resource_type="USER_BIOMETRICS",
            resource_id=usuario_id,
            description=f"Biometria facial cadastrada para usuário {usuario_id}",
            request=request
        )

        return {"message": "Vetor biométrico cadastrado com sucesso!", "vector_length": len(vector)}

biometria_service = BiometriaService()
