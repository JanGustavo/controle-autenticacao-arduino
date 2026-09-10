from fastapi import HTTPException, status

from app.database.connection import get_connection
from app.schemas.historico_acesso_schema import HistoricoAcessoCreate


class HistoricoAcessoService:
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

    def listar_historico(self):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, usuario_id, local_id, uid_card_lido, data_hora,
                           autorizado, percentual_similaridade, motivo_recusa
                    FROM historico_acesso
                    ORDER BY data_hora DESC, id DESC
                    """
                )
                return [self._row_to_dict(row) for row in cursor.fetchall()]

    def obter_historico(self, historico_id: int):
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
                registro = cursor.fetchone()

        if registro is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registro de histórico não encontrado.",
            )
        return self._row_to_dict(registro)

    def criar_historico(self, registro: HistoricoAcessoCreate):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO historico_acesso (
                        usuario_id, local_id, uid_card_lido, data_hora,
                        autorizado, percentual_similaridade, motivo_recusa
                    ) VALUES (%s, %s, %s, COALESCE(%s, CURRENT_TIMESTAMP), %s, %s, %s)
                    RETURNING id, usuario_id, local_id, uid_card_lido, data_hora,
                              autorizado, percentual_similaridade, motivo_recusa
                    """,
                    (
                        registro.usuario_id,
                        registro.local_id,
                        registro.uid_card_lido,
                        registro.data_hora,
                        registro.autorizado,
                        registro.percentual_similaridade,
                        registro.motivo_recusa,
                    ),
                )
                criado = cursor.fetchone()

        return self._row_to_dict(criado)


historico_acesso_service = HistoricoAcessoService()
