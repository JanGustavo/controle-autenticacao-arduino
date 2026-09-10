from fastapi import HTTPException, status
from psycopg.errors import IntegrityError

from app.database.connection import get_connection
from app.schemas.local_schema import LocalCreate, LocalUpdate


class LocalService:
    _campos = ("local_id", "nome", "identificador_dispositivo", "ativo", "criado_em")

    @classmethod
    def _row_to_dict(cls, row):
        return dict(zip(cls._campos, row, strict=True))

    @staticmethod
    def _normalizar_dispositivo(identificador: str) -> str:
        return identificador.strip().upper()

    def listar_locais(self):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT local_id, nome, identificador_dispositivo, ativo, criado_em
                    FROM local
                    ORDER BY local_id
                    """
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def obter_local(self, local_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT local_id, nome, identificador_dispositivo, ativo, criado_em
                    FROM local
                    WHERE local_id = %s
                    """,
                    (local_id,),
                )
                local = cursor.fetchone()

        if local is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local não encontrado.")
        return self._row_to_dict(local)

    def criar_local(self, local: LocalCreate):
        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO local (nome, identificador_dispositivo, ativo)
                        VALUES (%s, %s, %s)
                        RETURNING local_id, nome, identificador_dispositivo, ativo, criado_em
                        """,
                        (
                            local.nome.strip(),
                            self._normalizar_dispositivo(local.identificador_dispositivo),
                            local.ativo,
                        ),
                    )
                    criado = cursor.fetchone()
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este identificador de dispositivo já está cadastrado.",
            ) from error

        return self._row_to_dict(criado)

    def atualizar_local(self, local_id: int, local: LocalUpdate):
        campos = local.model_dump(exclude_unset=True)
        if not campos:
            return self.obter_local(local_id)

        if "nome" in campos:
            campos["nome"] = campos["nome"].strip()
        if "identificador_dispositivo" in campos:
            campos["identificador_dispositivo"] = self._normalizar_dispositivo(
                campos["identificador_dispositivo"]
            )

        valores = [campos[nome] for nome in campos]
        atribuicoes = ", ".join(f"{nome} = %s" for nome in campos)
        valores.append(local_id)

        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        f"""
                        UPDATE local
                        SET {atribuicoes}
                        WHERE local_id = %s
                        RETURNING local_id, nome, identificador_dispositivo, ativo, criado_em
                        """,
                        valores,
                    )
                    atualizado = cursor.fetchone()
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este identificador de dispositivo já está cadastrado.",
            ) from error

        if atualizado is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local não encontrado.")
        return self._row_to_dict(atualizado)

    def deletar_local(self, local_id: int):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM local WHERE local_id = %s RETURNING local_id", (local_id,))
                removido = cursor.fetchone()

        if removido is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local não encontrado.")
        return {"mensagem": "Local excluído com sucesso."}


local_service = LocalService()
