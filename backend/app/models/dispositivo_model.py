from app.database.connection import get_connection


class DispositivoModel:
    _campos = (
        "dispositivo_id",
        "local_id",
        "nome",
        "identificador",
        "ativo",
        "criado_em",
    )

    @classmethod
    def _row_to_dict(cls, row):
        return dict(zip(cls._campos, row, strict=True))

    def listar(
        self,
        q: str | None = None,
        local_id: int | None = None,
        ativo: bool | None = None,
    ):
        conditions: list[str] = []
        params: list[object] = []

        if q is not None and q.strip():
            term = f"%{q.strip().lower()}%"
            conditions.append(
                "(LOWER(d.nome) LIKE %s OR LOWER(d.identificador) LIKE %s "
                "OR LOWER(l.nome) LIKE %s)"
            )
            params.extend([term, term, term])

        if local_id is not None:
            conditions.append("d.local_id = %s")
            params.append(local_id)

        if ativo is not None:
            conditions.append("d.ativo = %s")
            params.append(ativo)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT d.dispositivo_id, d.local_id, d.nome,
                           d.identificador, d.ativo, d.criado_em
                    FROM dispositivo d
                    JOIN local l ON l.local_id = d.local_id
                    {where_clause}
                    ORDER BY d.dispositivo_id
                    """,
                    params if params else None,
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def buscar_por_id(self, dispositivo_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT dispositivo_id, local_id, nome,
                           identificador, ativo, criado_em
                    FROM dispositivo
                    WHERE dispositivo_id = %s
                    """,
                    (dispositivo_id,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def buscar_por_identificador(self, identificador: str):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT dispositivo_id, local_id, nome,
                           identificador, ativo, criado_em
                    FROM dispositivo
                    WHERE identificador = %s
                    """,
                    (identificador,),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def criar(
        self,
        *,
        local_id: int,
        nome: str,
        identificador: str,
        ativo: bool,
    ):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO dispositivo (local_id, nome, identificador, ativo)
                    VALUES (%s, %s, %s, %s)
                    RETURNING dispositivo_id, local_id, nome,
                              identificador, ativo, criado_em
                    """,
                    (local_id, nome, identificador, ativo),
                )
                row = cursor.fetchone()

        return self._row_to_dict(row)

    def atualizar(self, dispositivo_id: int, campos: dict):
        if not campos:
            return self.buscar_por_id(dispositivo_id)

        atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
        valores = [campos[nome] for nome in campos]
        valores.append(dispositivo_id)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE dispositivo
                    SET {atribuicoes}
                    WHERE dispositivo_id = %s
                    RETURNING dispositivo_id, local_id, nome,
                              identificador, ativo, criado_em
                    """,
                    valores,
                )
                row = cursor.fetchone()

        return self._row_to_dict(row) if row else None

    def deletar(self, dispositivo_id: int) -> bool:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM dispositivo WHERE dispositivo_id = %s RETURNING dispositivo_id",
                    (dispositivo_id,),
                )
                return cursor.fetchone() is not None


dispositivo_model = DispositivoModel()
