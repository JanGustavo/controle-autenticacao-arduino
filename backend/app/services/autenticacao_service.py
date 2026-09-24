import os
import json
from datetime import datetime
from fastapi import HTTPException, status
from app.services.face_service import FaceService
from app.database.connection import get_connection
from app.api.websocket import manager
from app.schemas.autenticacao_schema import TestarBiometriaResponse
from app.schemas.face_schema import SimilarityResult

class AutenticacaoService:
    @staticmethod
    async def testar_biometria(image_bytes: bytes) -> TestarBiometriaResponse:
        # Lê o threshold configurado para o InsightFace (padrão 0.50)
        min_sim = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.50"))
        vetor_instantaneo = FaceService.extract_face_vector(image_bytes)
        
        # 1. Rosto não identificado
        if not vetor_instantaneo:
            await AutenticacaoService._salvar_e_notificar_log(
                usuario_id=None,
                autorizado=False,
                similaridade=0.0,
                motivo_recusa="Nenhum rosto identificado na imagem da câmera"
            )
            raise HTTPException(status_code=400, detail="Nenhum rosto identificado na imagem da câmera.")

        print(f"\n[DEBUG - Biometria] Vetor Capturado ({len(vetor_instantaneo)} dim, primeiros 5 valores): {vetor_instantaneo[:5]}")

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT user_id, nome, vetor_facial FROM usuario WHERE vetor_facial IS NOT NULL"
                )
                usuarios_com_vetor = cursor.fetchall()

        # 2. Sem registros no banco
        if not usuarios_com_vetor:
            await AutenticacaoService._salvar_e_notificar_log(
                usuario_id=None,
                autorizado=False,
                similaridade=0.0,
                motivo_recusa="Nenhum usuário com biometria cadastrada no sistema"
            )
            return TestarBiometriaResponse(
                status="SEM_REGISTROS",
                mensagem="Nenhum usuário com biometria cadastrada no sistema.",
                similaridade=0.0,
                min_similarity=min_sim,
                aprovado=False,
            )

        usuarios_validos = []
        vetores_validos = []

        for row in usuarios_com_vetor:
            usuario_id, nome, vetor_facial_raw = row

            if isinstance(vetor_facial_raw, str):
                try:
                    vetor_salvo = json.loads(vetor_facial_raw)
                except Exception:
                    continue
            else:
                vetor_salvo = list(vetor_facial_raw) if vetor_facial_raw else None

            # ACEITA VETORES DE 512 DIMENSÕES (INSIGHTFACE) OU 128 (LEGADO)
            if vetor_salvo and len(vetor_salvo) in (512, 128):
                usuarios_validos.append((usuario_id, nome, vetor_salvo))
                vetores_validos.append(vetor_salvo)

        if not usuarios_validos:
            await AutenticacaoService._salvar_e_notificar_log(
                usuario_id=None,
                autorizado=False,
                similaridade=0.0,
                motivo_recusa="Nenhum usuário com vetor biométrico válido no sistema"
            )
            return TestarBiometriaResponse(
                status="SEM_REGISTROS",
                mensagem="Nenhum usuário com biometria cadastrada no sistema.",
                similaridade=0.0,
                min_similarity=min_sim,
                aprovado=False,
            )

        similaridades_matches = FaceService.calculate_batch_similarities(vetores_validos, vetor_instantaneo)

        print("\n--- [DEBUG] COMPARANDO COM USUÁRIOS DO BANCO ---")
        best_match = {"user_id": None, "nome": None, "similaridade": 0.0, "aprovado": False}
        
        # TRATA CADA ITEM DA RESPOSTA COMO SimilarityResult
        for (usuario_id, nome, vetor_salvo), sim_res in zip(usuarios_validos, similaridades_matches):
            sim = sim_res.similarity
            aprovado = sim_res.is_match

            print(f"👤 Usuário ID {usuario_id} ({nome}):")
            print(f"   - Vetor no Banco ({len(vetor_salvo)} dim, primeiros 5 valores): {vetor_salvo[:5]}")
            print(f"   - Similaridade Calculada: {sim:.4f} | Threshold: {sim_res.threshold} | Aprovado: {aprovado}")
            
            if sim > best_match["similaridade"]:
                best_match = {
                    "user_id": usuario_id,
                    "nome": nome,
                    "similaridade": sim,
                    "aprovado": aprovado,
                }

        print(f"🏆 Resultado Mais Próximo: {best_match['nome']} ({best_match['similaridade']:.4f}) - Match: {best_match['aprovado']}\n")

        # 3. Grava o evento no histórico de acessos e transmite via WebSocket
        autorizado = best_match["aprovado"]
        usuario_id_log = best_match["user_id"] if autorizado else None
        motivo = None if autorizado else "Acesso negado - similaridade insuficiente ou não cadastrado"

        await AutenticacaoService._salvar_e_notificar_log(
            usuario_id=usuario_id_log,
            autorizado=autorizado,
            similaridade=best_match["similaridade"],
            motivo_recusa=motivo,
            nome_usuario=best_match["nome"] if autorizado else None
        )
        
        return TestarBiometriaResponse(
            status="COMPARADO" if best_match["user_id"] else "NENHUM_CONFERENTE",
            usuario_id=best_match["user_id"],
            nome=best_match["nome"],
            usuario=best_match["nome"],
            similaridade=best_match["similaridade"],
            min_similarity=min_sim,
            aprovado=best_match["aprovado"],
            mensagem=f"Mais próximo: {best_match['nome']} ({best_match['similaridade']})" if best_match["nome"] else "Nenhum usuário correspondente encontrado.",
        )

    @staticmethod
    async def _salvar_e_notificar_log(
        usuario_id: int | None,
        autorizado: bool,
        similaridade: float,
        motivo_recusa: str | None,
        nome_usuario: str | None = None
    ) -> None:
        """Insere registro no banco e transmite via WebSocket para todos os clientes conectados."""
        agora = datetime.now()
        log_id = None
        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO historico_acesso 
                        (usuario_id, local_id, uid_card_lido, data_hora, autorizado, percentual_similaridade, motivo_recusa)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id;
                        """,
                        (usuario_id, None, None, agora, autorizado, similaridade, motivo_recusa)
                    )
                    res = cursor.fetchone()
                    if res:
                        log_id = res[0]
                    connection.commit()

            # Broadcast via WebSocket em tempo real
            evento = {
                "type": "NOVO_ACESSO",
                "data": {
                    "id": log_id,
                    "usuario_id": usuario_id,
                    "nome_usuario": nome_usuario,
                    "data_hora": agora.isoformat(),
                    "autorizado": autorizado,
                    "percentual_similaridade": similaridade,
                    "motivo_recusa": motivo_recusa,
                }
            }
            await manager.broadcast(evento)
        except Exception as e:
            print(f"Erro ao salvar e notificar log de acesso: {e}")


autenticacao_service = AutenticacaoService()