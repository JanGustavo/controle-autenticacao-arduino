from datetime import datetime
import json
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.services.face_service import FaceService
from app.database.connection import get_connection

router = APIRouter(prefix="/autenticacao", tags=["Autenticação de Acesso"])

@router.post("/testar-biometria")
async def testar_biometria(
    file: UploadFile = File(...)
):
    image_bytes = await file.read()
    vetor_instantaneo = FaceService.extract_face_vector(image_bytes)
    
    # 1. Rosto não identificado
    if not vetor_instantaneo:
        _salvar_log(
            usuario_id=None,
            autorizado=False,
            similaridade=0.0,
            motivo_recusa="Nenhum rosto identificado na imagem da câmera"
        )
        raise HTTPException(status_code=400, detail="Nenhum rosto identificado na imagem da câmera.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT user_id, nome, vetor_facial FROM usuario WHERE vetor_facial IS NOT NULL"
            )
            usuarios_com_vetor = cursor.fetchall()

    # 2. Sem registros no banco
    if not usuarios_com_vetor:
        _salvar_log(
            usuario_id=None,
            autorizado=False,
            similaridade=0.0,
            motivo_recusa="Nenhum usuário com biometria cadastrada no sistema"
        )
        return {
            "status": "SEM_REGISTROS",
            "mensagem": "Nenhum usuário com biometria cadastrada no sistema.",
            "similaridade": 0,
            "aprovado": False,
        }

    best_match = {"user_id": None, "nome": None, "similaridade": 0.0, "aprovado": False}

    for row in usuarios_com_vetor:
        usuario_id, nome, vetor_facial_raw = row

        if isinstance(vetor_facial_raw, str):
            try:
                vetor_salvo = json.loads(vetor_facial_raw)
            except Exception:
                continue
        else:
            vetor_salvo = list(vetor_facial_raw) if vetor_facial_raw else None

        if not vetor_salvo or len(vetor_salvo) != 128:
            continue

        similaridade, _ = FaceService.calculate_similarity(vetor_salvo, vetor_instantaneo)

        if similaridade > best_match["similaridade"]:
            best_match = {
                "user_id": usuario_id,
                "nome": nome,
                "similaridade": float(similaridade),
                "aprovado": bool(similaridade >= 70.0),
            }

    # 3. Grava o evento no histórico de acessos
    autorizado = best_match["aprovado"]
    usuario_id_log = best_match["user_id"] if autorizado else None
    motivo = None if autorizado else "Acesso negado - similaridade insuficiente ou não cadastrado"

    _salvar_log(
        usuario_id=usuario_id_log,
        autorizado=autorizado,
        similaridade=best_match["similaridade"],
        motivo_recusa=motivo
    )

    return {
        "status": "COMPARADO" if best_match["user_id"] else "NENHUM_CONFERENTE",
        "usuario_id": best_match["user_id"],
        "nome": best_match["nome"],
        "usuario": best_match["nome"],
        "similaridade": best_match["similaridade"],
        "aprovado": best_match["aprovado"],
        "mensagem": f"Mais próximo: {best_match['nome']} ({best_match['similaridade']}%)" if best_match["nome"] else "Nenhum usuário correspondente encontrado.",
    }


def _salvar_log(usuario_id: int | None, autorizado: bool, similaridade: float, motivo_recusa: str | None) -> None:
    """Insere o registro direto na tabela historico_acesso."""
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO historico_acesso 
                    (usuario_id, local_id, uid_card_lido, data_hora, autorizado, percentual_similaridade, motivo_recusa)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        usuario_id,
                        None,             # local_id (opcional no teste via painel)
                        None,             # uid_card_lido (opcional no teste via biometria pura)
                        datetime.now(),
                        autorizado,
                        similaridade,
                        motivo_recusa
                    )
                )
                connection.commit()
    except Exception as e:
        print(f"Erro ao salvar histórico de acesso: {e}")