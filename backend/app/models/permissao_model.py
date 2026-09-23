from app.database.connection import get_connection


class PermissaoModel:
    _campos = (
        "permissao_id",
        "usuario_id",
        "local_id",
        "horario_inicio",
        "horario_fim",
        "dias_semana",
    )

    @classmethod
    def _row_to_dict(cls, row):
        return dict(zip(cls._campos, row, strict=True))

    def listar(
        self,
        q: str | None = None,
        usuario_id: int | None = None,
        local_id: int | None = None,
    ):
        conditions: list[str] = []
        params: list[object] = []

        if q is not None and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append("(LOWER(u.nome) LIKE %s OR LOWER(l.nome) LIKE %s)")
            params.extend([term, term])

        if usuario_id is not None:
            conditions.append("p.usuario_id = %s")
            params.append(usuario_id)

        if local_id is not None:
            conditions.append("p.local_id = %s")
            params.append(local_id)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        join_clause = (
            "p JOIN usuario u ON p.usuario_id = u.user_id "
            "JOIN local l ON p.local_id = l.local_id"
            if conditions
            else "p"
        )

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT p.permissao_id, p.usuario_id, p.local_id,
                           p.horario_inicio, p.horario_fim, p.dias_semana
                    FROM permissao {join_clause}
                    {where_clause}
                    ORDER BY p.permissao_id
                    """,
                    params if params else None,
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def buscar_por_id(self, permissao_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT permissao_id, usuario_id, local_id,
                           horario_inicio, horario_fim, dias_semana
                    FROM permissao
                    WHERE permissao_id = %s
                    """,
                    (permissao_id,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def buscar_por_usuario_local(self, usuario_id: int, local_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT permissao_id, usuario_id, local_id,
                           horario_inicio, horario_fim, dias_semana
                    FROM permissao
                    WHERE usuario_id = %s AND local_id = %s
                    """,
                    (usuario_id, local_id),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    @classmethod
    def criar_com_cursor(
        cls,
        cursor,
        usuario_id: int,
        local_id: int,
        horario_inicio,
        horario_fim,
        dias_semana: list[int],
    ):
        cursor.execute(
            """
            INSERT INTO permissao (
                usuario_id, local_id, horario_inicio, horario_fim, dias_semana
            ) VALUES (%s, %s, %s, %s, %s)
            RETURNING permissao_id, usuario_id, local_id,
                      horario_inicio, horario_fim, dias_semana
            """,
            (usuario_id, local_id, horario_inicio, horario_fim, dias_semana),
        )
        return cls._row_to_dict(cursor.fetchone())

    def criar(
        self,
        usuario_id: int,
        local_id: int,
        horario_inicio,
        horario_fim,
        dias_semana: list[int],
    ):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                return self.criar_com_cursor(
                    cursor,
                    usuario_id,
                    local_id,
                    horario_inicio,
                    horario_fim,
                    dias_semana,
                )

    def atualizar(self, permissao_id: int, campos: dict):
        if not campos:
            return self.buscar_por_id(permissao_id)

        atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
        valores = [campos[nome] for nome in campos]
        valores.append(permissao_id)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE permissao
                    SET {atribuicoes}
                    WHERE permissao_id = %s
                    RETURNING permissao_id, usuario_id, local_id,
                              horario_inicio, horario_fim, dias_semana
                    """,
                    valores,
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def deletar(self, permissao_id: int) -> bool:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM permissao WHERE permissao_id = %s RETURNING permissao_id",
                    (permissao_id,),
                )
                return cursor.fetchone() is not None


permissao_model = PermissaoModel()
