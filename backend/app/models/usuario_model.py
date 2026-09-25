from psycopg.types.json import Jsonb

from app.database.connection import get_connection


class UsuarioModel:
    _campos = ("user_id", "nome", "uid_card", "vetor_facial", "ativo", "criado_em")
    _campos_simples = ("user_id", "nome", "uid_card", "ativo")

    @classmethod
    def _row_to_dict(cls, row):
        return dict(zip(cls._campos, row, strict=True))

    @classmethod
    def _row_to_dict_simples(cls, row):
        return dict(zip(cls._campos_simples, row, strict=True))

    def listar(self, q: str | None = None, ativo: bool | None = None):
        conditions: list[str] = []
        params: list[object] = []

        if q is not None and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                "(LOWER(nome) LIKE %s OR LOWER(COALESCE(uid_card, '')) LIKE %s)"
            )
            params.extend([term, term])

        if ativo is not None:
            conditions.append("ativo = %s")
            params.append(ativo)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT user_id, nome, uid_card, vetor_facial, ativo, criado_em
                    FROM usuario
                    {where_clause}
                    ORDER BY user_id
                    """,
                    params if params else None,
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def listar_simples(self, q: str | None = None, ativo: bool | None = None):
        """Lista usuários sem vetor_facial (para dropdowns/seletores)."""
        conditions: list[str] = []
        params: list[object] = []

        if q is not None and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                "(LOWER(nome) LIKE %s OR LOWER(COALESCE(uid_card, '')) LIKE %s)"
            )
            params.extend([term, term])

        if ativo is not None:
            conditions.append("ativo = %s")
            params.append(ativo)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT user_id, nome, uid_card, ativo
                    FROM usuario
                    {where_clause}
                    ORDER BY user_id
                    """,
                    params if params else None,
                )
                return [self._row_to_dict_simples(row) for row in cursor.fetchall()]

    def buscar_por_id(self, usuario_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id, nome, uid_card, vetor_facial, ativo, criado_em
                    FROM usuario
                    WHERE user_id = %s
                    """,
                    (usuario_id,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def buscar_por_uid(self, uid_card: str):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id, nome, uid_card, vetor_facial, ativo, criado_em
                    FROM usuario
                    WHERE uid_card = %s
                    """,
                    (uid_card,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def listar_ativos_com_biometria(self):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id, nome, uid_card, vetor_facial, ativo, criado_em
                    FROM usuario
                    WHERE ativo = TRUE
                      AND vetor_facial IS NOT NULL
                    ORDER BY user_id
                    """
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    @classmethod
    def criar_com_cursor(
        cls,
        cursor,
        nome: str,
        uid_card: str | None,
        vetor_facial: list[float] | None,
        ativo: bool,
    ):
        cursor.execute(
            """
            INSERT INTO usuario (nome, uid_card, vetor_facial, ativo)
            VALUES (%s, %s, %s, %s)
            RETURNING user_id, nome, uid_card, vetor_facial, ativo, criado_em
            """,
            (
                nome,
                uid_card,
                Jsonb(vetor_facial) if vetor_facial is not None else None,
                ativo,
            ),
        )
        return cls._row_to_dict(cursor.fetchone())

    def atualizar(self, usuario_id: int, campos: dict):
        if not campos:
            return self.buscar_por_id(usuario_id)

        valores = []
        for nome, valor in campos.items():
            if nome == "vetor_facial" and valor is not None:
                valor = Jsonb(valor)
            valores.append(valor)

        atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
        valores.append(usuario_id)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE usuario
                    SET {atribuicoes}
                    WHERE user_id = %s
                    RETURNING user_id, nome, uid_card, vetor_facial, ativo, criado_em
                    """,
                    valores,
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def atualizar_vetor_facial(self, usuario_id: int, vetor_facial: list[float]) -> bool:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE usuario
                    SET vetor_facial = %s
                    WHERE user_id = %s
                    RETURNING user_id
                    """,
                    (Jsonb(vetor_facial), usuario_id),
                )
                return cursor.fetchone() is not None

    def deletar(self, usuario_id: int) -> bool:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM usuario WHERE user_id = %s RETURNING user_id",
                    (usuario_id,),
                )
                return cursor.fetchone() is not None


usuario_model = UsuarioModel()
