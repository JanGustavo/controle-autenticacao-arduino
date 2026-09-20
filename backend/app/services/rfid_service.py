from app.database.connection import get_connection
from app.schemas.rfid_schema import VerificarCartaoResponse

class RFIDService:
    @staticmethod
    def verificar_cartao(uid_card: str) -> VerificarCartaoResponse:
        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    # Busca o usuário pelo UID do cartão. 
                    # Ajuste os nomes das colunas conforme a sua tabela real (ex: id ou user_id)
                    cursor.execute(
                        """
                        SELECT user_id, nome 
                        FROM usuario 
                        WHERE uid_card = %s
                        """,
                        (uid_card,)
                    )
                    
                    resultado = cursor.fetchone()

            # 1. Cartão não encontrado
            if not resultado:
                return VerificarCartaoResponse(
                    valido=False,
                    mensagem="Cartão não cadastrado no sistema."
                )
            
            usuario_id, nome = resultado
            
            # 2. Cartão válido e usuário encontrado
            return VerificarCartaoResponse(
                valido=True,
                usuario_id=usuario_id,
                nome=nome,
                mensagem="Cartão reconhecido. Aguardando validação facial."
            )
            
        except Exception as e:
            print(f"[RFIDService] Erro ao consultar banco: {e}")
            raise e

rfid_service = RFIDService()