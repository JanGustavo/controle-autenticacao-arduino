'''Endpoint responsável por receber a tentativa de acesso e unir a checagem do RFID com o vetor facial cadastrado.'''

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.services.face_service import FaceService
from app.services.usuario_service import UsuarioService
from app.services.historico_acesso_service import HistoricoAcessoService
from app.database.connection import get_connection

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


@router.post("/testar-biometria")
async def testar_biometria(
    foto_camera: UploadFile = File(...)
):
    # 1. Extrai o vetor facial da foto tirada
    image_bytes = await foto_camera.read()
    vetor_instantaneo = FaceService.extract_face_vector(image_bytes)
    
    if not vetor_instantaneo:
        raise HTTPException(status_code=400, detail="Nenhum rosto identificado na imagem da câmera.")

    # 2. Busca todos os usuários cadastrados com vetor facial
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT user_id, nome, vetor_facial FROM usuario WHERE vetor_facial IS NOT NULL"
            )
            usuarios_com_vetor = cursor.fetchall()

    if not usuarios_com_vetor:
        return {
            "status": "SEM_REGISTROS",
            "mensagem": "Nenhum usuário com biometria cadastrada no sistema.",
            "similaridade": 0,
            "aprovado": False,
        }

    # 3. Compara o vetor instantâneo com todos os vetores cadastrados
    best_match = {"user_id": None, "nome": None, "similaridade": 0, "aprovado": False}

    for row in usuarios_com_vetor:
        usuario_id, nome, vetor_facial_json = row
        vetor_salvo = list(vetor_facial_json) if vetor_facial_json else None

        if not vetor_salvo:
            continue

        similaridade, is_match = FaceService.calculate_similarity(vetor_salvo, vetor_instantaneo)

        if is_match and similaridade > best_match["similaridade"]:
            best_match = {
                "user_id": usuario_id,
                "nome": nome,
                "similaridade": similaridade,
                "aprovado": similaridade >= 70.0,
            }

    return {
        "status": "COMPARADO" if best_match["user_id"] else "NENHUM_CONFERENTE",
        "usuario_id": best_match["user_id"],
        "nome": best_match["nome"],
        "similaridade": best_match["similaridade"],
        "aprovado": best_match["aprovado"],
        "mensagem": "Acesso aprovado!" if best_match["aprovado"] else "Acesso negado - rosto não corresponde a nenhum usuário cadastrado ou similaridade abaixo do threshold.",
    }