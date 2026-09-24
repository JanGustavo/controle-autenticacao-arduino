from app.database.connection import get_connection


class LocalModel:
    _campos = ("local_id", "nome", "ativo", "criado_em")

    @classmethod
    def _row_to_dict(cls, row):
        return dict(zip(cls._campos, row, strict=True))

    def listar(self, q: str | None = None, ativo: bool | None = None):
        conditions: list[str] = []
        params: list[object] = []

        if q is not None and q.strip():
            conditions.append("LOWER(nome) LIKE %s")
            params.append(f"%{q.strip().lower()}%")

        if ativo is not None:
            conditions.append("ativo = %s")
            params.append(ativo)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT local_id, nome, ativo, criado_em
                    FROM local
                    {where_clause}
                    ORDER BY local_id
                    """,
                    params if params else None,
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def buscar_por_id(self, local_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT local_id, nome, ativo, criado_em
                    FROM local
                    WHERE local_id = %s
                    """,
                    (local_id,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def criar(self, nome: str, ativo: bool):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO local (nome, ativo)
                    VALUES (%s, %s)
                    RETURNING local_id, nome, ativo, criado_em
                    """,
                    (nome, ativo),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row)

    def atualizar(self, local_id: int, campos: dict):
        if not campos:
            return self.buscar_por_id(local_id)

        atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
        valores = [campos[nome] for nome in campos]
        valores.append(local_id)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE local
                    SET {atribuicoes}
                    WHERE local_id = %s
                    RETURNING local_id, nome, ativo, criado_em
                    """,
                    valores,
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def deletar(self, local_id: int) -> bool:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM local WHERE local_id = %s RETURNING local_id",
                    (local_id,),
                )
                return cursor.fetchone() is not None


local_model = LocalModel()
