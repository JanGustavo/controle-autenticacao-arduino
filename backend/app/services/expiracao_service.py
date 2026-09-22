"""
Expiração automática das tentativas de acesso.

Uma tentativa de acesso nasce como PENDENTE depois da aprovação do RFID.
Caso a etapa facial nunca seja concluída, a tentativa precisa sair desse
estado para não permanecer pendurada indefinidamente.

A varredura usa o índice (status, expira_em) da tabela tentativa_acesso.
"""

import asyncio
import logging
from datetime import datetime

from app.database.connection import get_connection

logger = logging.getLogger(__name__)

INTERVALO_VARREDURA_SEGUNDOS = 30

_MOTIVO_EXPIRACAO_AUTOMATICA = (
    "Tempo máximo para validação facial excedido "
    "(varredura automática)."
)


def expirar_tentativas_pendentes() -> int:
    """
    Marca como EXPIRADO cada tentativa PENDENTE cujo prazo já terminou
    e grava o resultado correspondente no histórico.

    A alteração de status e a criação dos registros de histórico ocorrem
    na mesma transação.
    """
    agora = datetime.now()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tentativa_acesso
                SET status = 'EXPIRADO',
                    concluido_em = %s,
                    motivo_recusa = %s
                WHERE status = 'PENDENTE'
                  AND expira_em < %s
                RETURNING tentativa_id,
                          usuario_id,
                          local_id,
                          uid_card_lido
                """,
                (
                    agora,
                    _MOTIVO_EXPIRACAO_AUTOMATICA,
                    agora,
                ),
            )

            expiradas = cursor.fetchall()

            if not expiradas:
                return 0

            for (
                tentativa_id,
                usuario_id,
                local_id,
                uid_card_lido,
            ) in expiradas:
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
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        FALSE,
                        NULL,
                        %s
                    )
                    """,
                    (
                        usuario_id,
                        local_id,
                        uid_card_lido,
                        agora,
                        _MOTIVO_EXPIRACAO_AUTOMATICA,
                    ),
                )

                logger.info(
                    "[Expiracao] tentativa_id=%s expirada "
                    "automaticamente (usuario_id=%s, local_id=%s).",
                    tentativa_id,
                    usuario_id,
                    local_id,
                )

        connection.commit()

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
