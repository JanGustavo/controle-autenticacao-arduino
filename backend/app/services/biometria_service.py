from fastapi import HTTPException, status

from app.services.face_service import FaceService
from app.services.usuario_service import usuario_service


class BiometriaService:
    @staticmethod
    def cadastrar_biometria(usuario_id: int, image_bytes: bytes) -> dict:
        vector = FaceService.extract_face_vector(image_bytes)
        if not vector:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nenhum rosto identificado na imagem enviada.",
            )

        usuario_service.atualizar_vetor_facial(usuario_id, vector)

        return {
            "message": "Vetor biométrico cadastrado com sucesso!",
            "vector_length": len(vector),
        }


biometria_service = BiometriaService()
