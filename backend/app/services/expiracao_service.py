"""
Expiração automática das tentativas de acesso.

A regra de expiração fica neste Service; SQL e persistência ficam nos Models.
"""

import asyncio
import logging
from datetime import datetime

from app.database.connection import get_connection
from app.models.historico_acesso_model import historico_acesso_model
from app.models.tentativa_acesso_model import tentativa_acesso_model

logger = logging.getLogger(__name__)

INTERVALO_VARREDURA_SEGUNDOS = 30

_MOTIVO_EXPIRACAO_AUTOMATICA = (
    "Tempo máximo para validação facial excedido "
    "(varredura automática)."
)


def expirar_tentativas_pendentes() -> int:
    """
    Expira tentativas vencidas e grava o histórico na mesma transação.
    """
    agora = datetime.now()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            expiradas = tentativa_acesso_model.expirar_pendentes_com_cursor(
                cursor,
                agora=agora,
                motivo_recusa=_MOTIVO_EXPIRACAO_AUTOMATICA,
            )

            for tentativa in expiradas:
                historico_acesso_model.criar_com_cursor(
                    cursor,
                    usuario_id=tentativa["usuario_id"],
                    local_id=tentativa["local_id"],
                    dispositivo_id=tentativa["dispositivo_id"],
                    uid_card_lido=tentativa["uid_card_lido"],
                    data_hora=agora,
                    autorizado=False,
                    percentual_similaridade=None,
                    motivo_recusa=_MOTIVO_EXPIRACAO_AUTOMATICA,
                )

                logger.info(
                    "[Expiracao] tentativa_id=%s expirada "
                    "automaticamente (usuario_id=%s, local_id=%s).",
                    tentativa["tentativa_id"],
                    tentativa["usuario_id"],
                    tentativa["local_id"],
                )

    return len(expiradas)


async def loop_expiracao_periodica() -> None:
    """
    Executa a varredura continuamente durante a vida da aplicação.

    Um erro de banco não derruba a task. A próxima execução tentará
    novamente após o intervalo configurado.
    """
    while True:
        try:
            quantidade = await asyncio.to_thread(
                expirar_tentativas_pendentes
            )

            if quantidade:
                logger.info(
                    "[Expiracao] %d tentativa(s) marcada(s) como EXPIRADO.",
                    quantidade,
                )

        except asyncio.CancelledError:
            logger.info("[Expiracao] Task encerrada.")
            raise

        except Exception:
            logger.exception(
                "[Expiracao] Erro durante a varredura periódica."
            )

        await asyncio.sleep(INTERVALO_VARREDURA_SEGUNDOS)
