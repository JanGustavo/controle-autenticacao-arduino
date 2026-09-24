from uuid import UUID

from app.database.connection import get_connection


class TentativaAcessoModel:
    _campos = (
        "tentativa_id",
        "usuario_id",
        "local_id",
        "dispositivo_id",
        "uid_card_lido",
        "status",
        "criado_em",
        "expira_em",
    )

    @classmethod
    def _row_to_dict(cls, row):
        return dict(zip(cls._campos, row, strict=True))

    def buscar_por_id(self, tentativa_id: UUID):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT tentativa_id, usuario_id, local_id, dispositivo_id,
                           uid_card_lido, status, criado_em, expira_em
                    FROM tentativa_acesso
                    WHERE tentativa_id = %s
                    """,
                    (tentativa_id,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def buscar_pendente_por_cartao_dispositivo(
        self,
        uid_card: str,
        identificador_dispositivo: str,
        status_pendente: str,
    ):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT t.tentativa_id
                    FROM tentativa_acesso t
                    JOIN dispositivo d ON d.dispositivo_id = t.dispositivo_id
                    WHERE t.uid_card_lido = %s
                      AND d.identificador = %s
                      AND t.status = %s
                    ORDER BY t.criado_em DESC
                    LIMIT 1
                    """,
                    (uid_card, identificador_dispositivo, status_pendente),
                )
                row = cursor.fetchone()

        return row[0] if row else None

    @staticmethod
    def criar_com_cursor(
        cursor,
        *,
        tentativa_id: UUID,
        usuario_id: int,
        local_id: int,
        dispositivo_id: int,
        uid_card_lido: str,
        status: str,
        criado_em,
        expira_em,
    ) -> None:
        cursor.execute(
            """
            INSERT INTO tentativa_acesso (
                tentativa_id, usuario_id, local_id, dispositivo_id,
                uid_card_lido, status, criado_em, expira_em
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                tentativa_id,
                usuario_id,
                local_id,
                dispositivo_id,
                uid_card_lido,
                status,
                criado_em,
                expira_em,
            ),
        )

    @staticmethod
    def buscar_contexto_finalizacao_com_cursor(cursor, tentativa_id: UUID):
        cursor.execute(
            """
            SELECT t.tentativa_id,
                   t.usuario_id,
                   t.local_id,
                   t.dispositivo_id,
                   t.uid_card_lido,
                   t.status,
                   t.expira_em,
                   t.criado_em,
                   u.nome,
                   u.ativo,
                   l.ativo,
                   d.ativo,
                   p.horario_inicio,
                   p.horario_fim,
                   p.dias_semana
            FROM tentativa_acesso t
            JOIN usuario u ON u.user_id = t.usuario_id
            JOIN local l ON l.local_id = t.local_id
            JOIN dispositivo d ON d.dispositivo_id = t.dispositivo_id
            LEFT JOIN permissao p
                ON p.usuario_id = t.usuario_id
               AND p.local_id = t.local_id
            WHERE t.tentativa_id = %s
            FOR UPDATE OF t
            """,
            (tentativa_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None

        campos = (
            "tentativa_id",
            "usuario_id",
            "local_id",
            "dispositivo_id",
            "uid_card_lido",
            "status",
            "expira_em",
            "criado_em",
            "nome_usuario",
            "usuario_ativo",
            "local_ativo",
            "dispositivo_ativo",
            "horario_inicio",
            "horario_fim",
            "dias_semana",
        )
        return dict(zip(campos, row, strict=True))

    def buscar_resultado_por_dispositivo(
        self,
        tentativa_id: UUID,
        identificador_dispositivo: str,
    ):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT t.tentativa_id,
                           t.status,
                           t.percentual_similaridade,
                           t.motivo_recusa,
                           t.criado_em,
                           t.concluido_em
                    FROM tentativa_acesso t
                    JOIN dispositivo d
                      ON d.dispositivo_id = t.dispositivo_id
                    WHERE t.tentativa_id = %s
                      AND d.identificador = %s
                    """,
                    (tentativa_id, identificador_dispositivo),
                )
                row = cursor.fetchone()

        if row is None:
            return None

        campos = (
            "tentativa_id",
            "status",
            "percentual_similaridade",
            "motivo_recusa",
            "criado_em",
            "concluido_em",
        )
        return dict(zip(campos, row, strict=True))

    @staticmethod
    def buscar_estado_com_cursor(cursor, tentativa_id: UUID):
        cursor.execute(
            """
            SELECT percentual_similaridade, status, motivo_recusa
            FROM tentativa_acesso
            WHERE tentativa_id = %s
            """,
            (tentativa_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return {
            "percentual_similaridade": row[0],
            "status": row[1],
            "motivo_recusa": row[2],
        }

    @staticmethod
    def expirar_pendentes_com_cursor(
        cursor,
        *,
        agora,
        motivo_recusa: str,
    ):
        cursor.execute(
            """
            UPDATE tentativa_acesso
            SET status = 'EXPIRADO',
                concluido_em = %s,
                motivo_recusa = %s
            WHERE status = 'PENDENTE'
              AND expira_em < %s
            RETURNING tentativa_id, usuario_id, local_id, dispositivo_id, uid_card_lido
            """,
            (agora, motivo_recusa, agora),
        )
        campos = (
            "tentativa_id",
            "usuario_id",
            "local_id",
            "dispositivo_id",
            "uid_card_lido",
        )
        return [
            dict(zip(campos, row, strict=True))
            for row in cursor.fetchall()
        ]

    @staticmethod
    def finalizar_com_cursor(
        cursor,
        *,
        tentativa_id: UUID,
        status: str,
        concluido_em,
        percentual_similaridade: float,
        motivo_recusa: str | None,
    ) -> None:
        cursor.execute(
            """
            UPDATE tentativa_acesso
            SET status = %s,
                concluido_em = %s,
                percentual_similaridade = %s,
                motivo_recusa = %s
            WHERE tentativa_id = %s
            """,
            (
                status,
                concluido_em,
                percentual_similaridade,
                motivo_recusa,
                tentativa_id,
            ),
        )


tentativa_acesso_model = TentativaAcessoModel()
