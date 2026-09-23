from app.database.connection import get_connection


class HistoricoAcessoModel:
    _campos = (
        "id",
        "usuario_id",
        "local_id",
        "uid_card_lido",
        "data_hora",
        "autorizado",
        "percentual_similaridade",
        "motivo_recusa",
    )

    @classmethod
    def _row_to_dict(cls, row):
        return dict(zip(cls._campos, row, strict=True))

    def listar(
        self,
        q: str | None = None,
        usuario_id: int | None = None,
        local_id: int | None = None,
        autorizado: bool | None = None,
    ):
        conditions: list[str] = []
        params: list[object] = []

        if q is not None and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                "(LOWER(COALESCE(u.nome, '')) LIKE %s "
                "OR LOWER(COALESCE(l.nome, '')) LIKE %s "
                "OR LOWER(COALESCE(h.uid_card_lido, '')) LIKE %s "
                "OR LOWER(COALESCE(h.motivo_recusa, '')) LIKE %s)"
            )
            params.extend([term, term, term, term])

        if usuario_id is not None:
            conditions.append("h.usuario_id = %s")
            params.append(usuario_id)

        if local_id is not None:
            conditions.append("h.local_id = %s")
            params.append(local_id)

        if autorizado is not None:
            conditions.append("h.autorizado = %s")
            params.append(autorizado)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT h.id, h.usuario_id, h.local_id, h.uid_card_lido,
                           h.data_hora, h.autorizado,
                           h.percentual_similaridade, h.motivo_recusa
                    FROM historico_acesso h
                    LEFT JOIN usuario u ON h.usuario_id = u.user_id
                    LEFT JOIN local l ON h.local_id = l.local_id
                    {where_clause}
                    ORDER BY h.data_hora DESC, h.id DESC
                    """,
                    params if params else None,
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def buscar_por_id(self, historico_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, usuario_id, local_id, uid_card_lido, data_hora,
                           autorizado, percentual_similaridade, motivo_recusa
                    FROM historico_acesso
                    WHERE id = %s
                    """,
                    (historico_id,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    @classmethod
    def criar_com_cursor(
        cls,
        cursor,
        *,
        usuario_id: int | None,
        local_id: int | None,
        uid_card_lido: str | None,
        data_hora,
        autorizado: bool,
        percentual_similaridade: float | None,
        motivo_recusa: str | None,
    ):
        cursor.execute(
            """
            INSERT INTO historico_acesso (
                usuario_id, local_id, uid_card_lido, data_hora,
                autorizado, percentual_similaridade, motivo_recusa
            )
            VALUES (%s, %s, %s, COALESCE(%s, CURRENT_TIMESTAMP), %s, %s, %s)
            RETURNING id, usuario_id, local_id, uid_card_lido, data_hora,
                      autorizado, percentual_similaridade, motivo_recusa
            """,
            (
                usuario_id,
                local_id,
                uid_card_lido,
                data_hora,
                autorizado,
                percentual_similaridade,
                motivo_recusa,
            ),
        )
        return cls._row_to_dict(cursor.fetchone())

    def criar(self, **dados):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                return self.criar_com_cursor(cursor, **dados)


historico_acesso_model = HistoricoAcessoModel()
