'''Lógica para validar a leitura da porta serial (Arduino) ou aceitar requisições de teste mockadas/fallbacks '''


from datetime import datetime

from app.database.connection import get_connection

class RFIDService:

    @staticmethod
    def _normalizar_uid(uid_card: str) -> str:
        return uid_card.replace(" ", "").replace(":", "").replace("-", "").upper()

    def validar_acesso(self, esp_id: int, uid_card: str) -> int:
        uid_card = self._normalizar_uid(uid_card)

        with get_connection() as connection:
            with connection.cursor() as cursor:

                # Descobre qual local pertence ao ESP
                cursor.execute(
                    """
                    SELECT local_id
                    FROM local
                    WHERE identificador_dispositivo = %s
                      AND ativo = TRUE
                    """,
                    (esp_id,),
                )

                local = cursor.fetchone()

                if local is None:
                    return 0

                local_id = local[0]

                # Procura o usuário pelo cartão
                cursor.execute(
                    """
                    SELECT user_id, ativo
                    FROM usuario
                    WHERE uid_card = %s
                    """,
                    (uid_card,),
                )

                usuario = cursor.fetchone()

                if usuario is None:
                    self._registrar_historico(
                        cursor,
                        usuario_id=None,
                        local_id=local_id,
                        uid_card=uid_card,
                        autorizado=False,
                        motivo="Cartão não cadastrado",
                    )
                    connection.commit()
                    return 0

                usuario_id, ativo = usuario

                # Usuário desativado
                if not ativo:
                    self._registrar_historico(
                        cursor,
                        usuario_id=usuario_id,
                        local_id=local_id,
                        uid_card=uid_card,
                        autorizado=False,
                        motivo="Usuário inativo",
                    )
                    connection.commit()
                    return 0

                # Verifica permissão para este local
                agora = datetime.now()
                dia_semana = agora.isoweekday()
                horario = agora.time()

                cursor.execute(
                    """
                    SELECT permissao_id
                    FROM permissao
                    WHERE usuario_id = %s
                      AND local_id = %s
                      AND %s = ANY(dias_semana)
                      AND horario_inicio <= %s
                      AND horario_fim >= %s
                    """,
                    (
                        usuario_id,
                        local_id,
                        dia_semana,
                        horario,
                        horario,
                    ),
                )

                permissao = cursor.fetchone()

                autorizado = permissao is not None

                motivo = None if autorizado else "Sem permissão para este local ou horário"

                # Registra o acesso
                self._registrar_historico(
                    cursor,
                    usuario_id=usuario_id,
                    local_id=local_id,
                    uid_card=uid_card,
                    autorizado=autorizado,
                    motivo=motivo,
                )

                connection.commit()

                return 1 if autorizado else 0

    @staticmethod
    def _registrar_historico(
        cursor,
        usuario_id: int | None,
        local_id: int | None,
        uid_card: str,
        autorizado: bool,
        motivo: str | None,
    ):
        cursor.execute(
            """
            INSERT INTO historico_acesso (
                usuario_id,
                local_id,
                uid_card_lido,
                data_hora,
                autorizado,
                percentual_similaridade,
                motivo_recusa
            )
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP, %s, %s, %s)
            """,
            (
                usuario_id,
                local_id,
                uid_card,
                autorizado,
                None,
                motivo,
            ),
        )


rfid_service = RFIDService()