'''Endpoint responsável por receber a tentativa de acesso e unir a checagem do RFID com o vetor facial cadastrado.'''

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.services.face_service import FaceService
from app.services.usuario_service import UsuarioService
from app.services.historico_acesso_service import HistoricoAcessoService

router = APIRouter(prefix="/autenticacao", tags=["Autenticação de Acesso"])

@router.post("/validar-acesso")
async def validar_acesso(
    card_uid: str = Form(...),
    local_id: int = Form(...),
    foto_camera: UploadFile = File(...)
):
    # 1. Busca o usuário cadastrado a partir do Cartão RFID
    usuario = await UsuarioService.get_by_card_uid(card_uid)
    if not usuario or not usuario.facial_vector:
        # Grava log de tentativa falha por cartão não cadastrado
        await HistoricoAcessoService.registrar_log(usuario_id=None, local_id=local_id, status="RECUSADO_CARTAO_INVALIDO")
        raise HTTPException(status_code=401, detail="Cartão RFID não cadastrado ou biometria ausente.")

    # 2. Extrai o vetor facial da foto tirada no momento da entrada
    image_bytes = await foto_camera.read()
    vetor_instantaneo = FaceService.extract_face_vector(image_bytes)
    
    if not vetor_instantaneo:
        await HistoricoAcessoService.registrar_log(usuario_id=usuario.id, local_id=local_id, status="RECUSADO_ROSTO_NAO_DETECTADO")
        raise HTTPException(status_code=400, detail="Nenhum rosto identificado na imagem da câmera.")

    # 3. Compara o vetor instantâneo com o vetor salvo no cadastro do usuário
    similaridade, is_match = FaceService.calculate_similarity(usuario.facial_vector, vetor_instantaneo)

    # 4. Decisão final e registro histórico
    if not is_match:
        await HistoricoAcessoService.registrar_log(
            usuario_id=usuario.id, local_id=local_id, status=f"RECUSADO_BIOMETRIA_{similaridade}%"
        )
        return {"status": "NEGADO", "motivo": "Face não corresponde ao titular do cartão", "similaridade": similaridade}

    # Registro de acesso permitido com sucesso
    await HistoricoAcessoService.registrar_log(
        usuario_id=usuario.id, local_id=local_id, status="PERMITIDO"
    )
    return {"status": "LIBERADO", "usuario": usuario.nome, "similaridade": similaridade}