import json
import os
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from app.database.connection import get_connection
from app.schemas.rfid_schema import (
    VerificarBiometriaArduinoRequest,
    VerificarBiometriaArduinoResponse,
    VerificarCartaoResponse,
)
from app.services.face_service import FaceService


class AcessoServiceError(Exception):
    """Erro base do fluxo de tentativa de acesso."""


class AcessoNegadoError(AcessoServiceError):
    """RFID não pode iniciar uma tentativa de acesso."""


class TentativaAcessoNaoEncontradaError(AcessoServiceError):
    """Tentativa inexistente ou não disponível para finalização."""


class AcessoService:
    """
    Orquestra a tentativa completa de acesso.

    Não mantém uma transação aberta durante a espera da biometria.
    O RFID cria uma tentativa PENDENTE; a biometria finaliza essa
    tentativa em uma segunda transação curta e atômica.
    """

    _STATUS_PENDENTE = "PENDENTE"
    _STATUS_AUTORIZADO = "AUTORIZADO"
    _STATUS_NEGADO = "NEGADO"
    _STATUS_EXPIRADO = "EXPIRADO"

    @staticmethod
    def _agora() -> datetime:
        return datetime.now()

    @staticmethod
    def _permissao_valida(
        horario_inicio,
        horario_fim,
        dias_semana: list[int],
        agora: datetime,
    ) -> tuple[bool, str | None]:
        dia_atual = (agora.isoweekday() % 7) + 1

        if dia_atual not in dias_semana:
            return False, (
                "Cartão válido, mas fora dos dias de acesso permitidos "
                "para este usuário."
            )

        hora_atual = agora.time()

        if horario_inicio <= horario_fim:
            dentro_horario = horario_inicio <= hora_atual <= horario_fim
        else:
            dentro_horario = (
                hora_atual >= horario_inicio or hora_atual <= horario_fim
            )

        if not dentro_horario:
            return False, (
                "Cartão válido, mas fora do horário de acesso permitido "
                "para este usuário."
            )

        return True, None

    @classmethod
    def iniciar_tentativa(
        cls,
        uid_card: str,
        identificador_dispositivo: str,
    ) -> VerificarCartaoResponse:
        """
        RFID -> local/dispositivo -> usuário -> permissão -> tentativa PENDENTE.

        O histórico de uma negação desta etapa é gravado na mesma transação.
        A exceção só é lançada depois do commit, evitando rollback do histórico.
        """
        agora = cls._agora()
        timeout_segundos = int(
            os.getenv("ACCESS_ATTEMPT_TIMEOUT_SECONDS", "15")
        )
        tentativa_id = uuid4()

        negacao: str | None = None
        resposta: VerificarCartaoResponse | None = None

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT local_id, ativo
                    FROM local
                    WHERE identificador_dispositivo = %s
                    """,
                    (identificador_dispositivo,),
                )
                local = cursor.fetchone()

                cursor.execute(
                    """
                    SELECT user_id, nome, ativo
                    FROM usuario
                    WHERE uid_card = %s
                    """,
                    (uid_card,),
                )
                usuario = cursor.fetchone()

                local_id = local[0] if local else None
                usuario_id = usuario[0] if usuario else None

                if not local:
                    negacao = "Dispositivo não cadastrado no sistema."
                elif not local[1]:
                    negacao = "Local/dispositivo desativado."
                elif not usuario:
                    negacao = "Cartão não cadastrado no sistema."
                elif not usuario[2]:
                    negacao = "Usuário inativo."
                else:
                    cursor.execute(
                        """
                        SELECT horario_inicio, horario_fim, dias_semana
                        FROM permissao
                        WHERE usuario_id = %s
                          AND local_id = %s
                        """,
                        (usuario_id, local_id),
                    )
                    permissao = cursor.fetchone()

                    if not permissao:
                        negacao = "Usuário sem permissão para este local."
                    else:
                        permitido, motivo = cls._permissao_valida(
                            permissao[0],
                            permissao[1],
                            list(permissao[2]),
                            agora,
                        )
                        if not permitido:
                            negacao = motivo or "Acesso fora da permissão."

                if negacao:
                    cursor.execute(
                        """
                        INSERT INTO historico_acesso (
                            usuario_id,
                            local_id,
                            uid_card_lido,
                            autorizado,
                            percentual_similaridade,
                            motivo_recusa
                        )
                        VALUES (%s, %s, %s, FALSE, NULL, %s)
                        """,
                        (
                            usuario_id,
                            local_id,
                            uid_card,
                            negacao,
                        ),
                    )
                else:
                    expira_em = agora + timedelta(seconds=timeout_segundos)

                    cursor.execute(
                        """
                        INSERT INTO tentativa_acesso (
                            tentativa_id,
                            usuario_id,
                            local_id,
                            uid_card_lido,
                            identificador_dispositivo,
                            status,
                            criado_em,
                            expira_em
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            tentativa_id,
                            usuario_id,
                            local_id,
                            uid_card,
                            identificador_dispositivo,
                            cls._STATUS_PENDENTE,
                            agora,
                            expira_em,
                        ),
                    )

                    resposta = VerificarCartaoResponse(
                        existe=True,
                        tentativa_id=tentativa_id,
                        usuario_id=usuario_id,
                        nome=usuario[1],
                        mensagem=(
                            "Cartão reconhecido e dentro da permissão. "
                            "Aguardando validação facial."
                        ),
                        proxima_etapa="BIOMETRIA",
                    )

        if negacao:
            raise AcessoNegadoError(negacao)

        if resposta is None:
            raise AcessoServiceError(
                "Não foi possível iniciar a tentativa de acesso."
            )

        return resposta

    @staticmethod
    def _normalizar_vetor(raw_vector: Any) -> list[float] | None:
        if raw_vector is None:
            return None

        try:
            if isinstance(raw_vector, str):
                raw_vector = json.loads(raw_vector)

            vetor = list(raw_vector)
            return vetor if len(vetor) in (512, 128) else None
        except (TypeError, ValueError, json.JSONDecodeError):
            return None

    @classmethod
    def verificar_face_tentativa(
        cls,
        tentativa_id: UUID,
        image_bytes: bytes,
    ) -> VerificarBiometriaArduinoResponse:
        """
        Etapa temporária 1:N.

        Mesmo usando 1:N, a decisão final fica vinculada ao usuário
        identificado pelo RFID: o melhor candidato precisa ser o mesmo
        usuário da tentativa.
        """
        tentativa = cls._buscar_tentativa(tentativa_id)

        if tentativa is None:
            raise TentativaAcessoNaoEncontradaError(
                "Tentativa de acesso não encontrada."
            )

        if tentativa["status"] != cls._STATUS_PENDENTE:
            raise TentativaAcessoNaoEncontradaError(
                "Tentativa de acesso já foi finalizada."
            )

        face_result = FaceService.extract_face_vector_detailed(image_bytes)

        if not face_result.success or not face_result.vector:
            return cls._finalizar_tentativa(
                tentativa_id=tentativa_id,
                aprovado=False,
                similaridade=0.0,
                motivo_recusa=face_result.message,
            )

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id, nome, vetor_facial
                    FROM usuario
                    WHERE ativo = TRUE
                      AND vetor_facial IS NOT NULL
                    ORDER BY user_id
                    """
                )
                usuarios = cursor.fetchall()

        usuarios_validos: list[tuple[int, str, list[float]]] = []
        vetores: list[list[float]] = []

        for usuario_id, nome, vetor_raw in usuarios:
            vetor = cls._normalizar_vetor(vetor_raw)
            if vetor is None:
                continue

            usuarios_validos.append((usuario_id, nome, vetor))
            vetores.append(vetor)

        if not usuarios_validos:
            return cls._finalizar_tentativa(
                tentativa_id=tentativa_id,
                aprovado=False,
                similaridade=0.0,
                motivo_recusa=(
                    "Nenhum usuário com vetor biométrico válido "
                    "no sistema."
                ),
            )

        resultados = FaceService.calculate_batch_similarities(
            vetores,
            face_result.vector,
        )

        melhor_indice = max(
            range(len(resultados)),
            key=lambda index: resultados[index].similarity,
        )

        melhor_usuario_id = usuarios_validos[melhor_indice][0]
        melhor_resultado = resultados[melhor_indice]

        if melhor_usuario_id != tentativa["usuario_id"]:
            aprovado = False
            motivo = (
                "Rosto identificado como outro usuário; "
                "não corresponde ao cartão apresentado."
            )
        elif not melhor_resultado.is_match:
            aprovado = False
            motivo = "Similaridade facial insuficiente."
        else:
            aprovado = True
            motivo = None

        return cls._finalizar_tentativa(
            tentativa_id=tentativa_id,
            aprovado=aprovado,
            similaridade=melhor_resultado.similarity,
            motivo_recusa=motivo,
        )

    @classmethod
    def finalizar_resultado_arduino(
        cls,
        dados: VerificarBiometriaArduinoRequest,
    ) -> VerificarBiometriaArduinoResponse:
        """
        Compatibilidade temporária com o firmware atual.

        O módulo facial ainda não envia tentativa_id, então usamos a
        tentativa PENDENTE mais recente do mesmo cartão + dispositivo.
        """
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT tentativa_id
                    FROM tentativa_acesso
                    WHERE uid_card_lido = %s
                      AND identificador_dispositivo = %s
                      AND status = %s
                    ORDER BY criado_em DESC
                    LIMIT 1
                    """,
                    (
                        dados.uid_card.upper(),
                        dados.identificador_dispositivo,
                        cls._STATUS_PENDENTE,
                    ),
                )
                row = cursor.fetchone()

        if row is None:
            raise TentativaAcessoNaoEncontradaError(
                "Nenhuma tentativa PENDENTE encontrada para "
                "este cartão e dispositivo."
            )

        return cls._finalizar_tentativa(
            tentativa_id=row[0],
            aprovado=dados.aprovado,
            similaridade=dados.similaridade,
            motivo_recusa=(
                None
                if dados.aprovado
                else "Biometria recusada pelo módulo facial."
            ),
        )

    @classmethod
    def _buscar_tentativa(
        cls,
        tentativa_id: UUID,
    ) -> dict[str, Any] | None:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT tentativa_id,
                           usuario_id,
                           local_id,
                           uid_card_lido,
                           identificador_dispositivo,
                           status,
                           criado_em,
                           expira_em
                    FROM tentativa_acesso
                    WHERE tentativa_id = %s
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
            "uid_card_lido",
            "identificador_dispositivo",
            "status",
            "criado_em",
            "expira_em",
        )
        return dict(zip(campos, row, strict=True))

    @classmethod
    def _finalizar_tentativa(
        cls,
        tentativa_id: UUID,
        aprovado: bool,
        similaridade: float,
        motivo_recusa: str | None,
    ) -> VerificarBiometriaArduinoResponse:
        agora = cls._agora()

        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT t.tentativa_id,
                           t.usuario_id,
                           t.local_id,
                           t.uid_card_lido,
                           t.status,
                           t.expira_em,
                           u.nome,
                           u.ativo,
                           l.ativo,
                           p.horario_inicio,
                           p.horario_fim,
                           p.dias_semana
                    FROM tentativa_acesso t
                    JOIN usuario u ON u.user_id = t.usuario_id
                    JOIN local l ON l.local_id = t.local_id
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
                    raise TentativaAcessoNaoEncontradaError(
                        "Tentativa de acesso não encontrada."
                    )

                (
                    _,
                    usuario_id,
                    local_id,
                    uid_card,
                    status_atual,
                    expira_em,
                    nome_usuario,
                    usuario_ativo,
                    local_ativo,
                    horario_inicio,
                    horario_fim,
                    dias_semana,
                ) = row

                if status_atual != cls._STATUS_PENDENTE:
                    cursor.execute(
                        """
                        SELECT percentual_similaridade,
                               status,
                               motivo_recusa
                        FROM tentativa_acesso
                        WHERE tentativa_id = %s
                        """,
                        (tentativa_id,),
                    )
                    estado = cursor.fetchone()

                    aprovado_final = (
                        bool(estado)
                        and estado[1] == cls._STATUS_AUTORIZADO
                    )
                    similaridade_final = (
                        float(estado[0] or 0.0)
                        if estado
                        else 0.0
                    )
                    mensagem = (
                        estado[2]
                        if estado and estado[2]
                        else "Tentativa já finalizada."
                    )

                    return VerificarBiometriaArduinoResponse(
                        tentativa_id=tentativa_id,
                        usuario_id=usuario_id,
                        nome=nome_usuario,
                        local_id=local_id,
                        aprovado=aprovado_final,
                        similaridade=similaridade_final,
                        comando=(
                            "liberar"
                            if aprovado_final
                            else "negar"
                        ),
                        mensagem=mensagem,
                    )

                if agora > expira_em:
                    status_final = cls._STATUS_EXPIRADO
                    motivo_final = (
                        "Tempo máximo para validação facial excedido."
                    )
                    aprovado_final = False
                elif not usuario_ativo:
                    status_final = cls._STATUS_NEGADO
                    motivo_final = "Usuário está inativo."
                    aprovado_final = False
                elif not local_ativo:
                    status_final = cls._STATUS_NEGADO
                    motivo_final = "Local/dispositivo está inativo."
                    aprovado_final = False
                elif (
                    not horario_inicio
                    or not horario_fim
                    or not dias_semana
                ):
                    status_final = cls._STATUS_NEGADO
                    motivo_final = (
                        "Permissão de acesso não encontrada "
                        "no momento da validação."
                    )
                    aprovado_final = False
                else:
                    permitido, motivo_permissao = cls._permissao_valida(
                        horario_inicio,
                        horario_fim,
                        list(dias_semana),
                        agora,
                    )

                    if not permitido:
                        status_final = cls._STATUS_NEGADO
                        motivo_final = (
                            motivo_permissao
                            or "Acesso fora da permissão."
                        )
                        aprovado_final = False
                    elif not aprovado:
                        status_final = cls._STATUS_NEGADO
                        motivo_final = (
                            motivo_recusa or "Biometria recusada."
                        )
                        aprovado_final = False
                    else:
                        status_final = cls._STATUS_AUTORIZADO
                        motivo_final = None
                        aprovado_final = True

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
                        status_final,
                        agora,
                        float(similaridade),
                        motivo_final,
                        tentativa_id,
                    ),
                )

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
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        usuario_id,
                        local_id,
                        uid_card,
                        agora,
                        aprovado_final,
                        float(similaridade),
                        motivo_final,
                    ),
                )

        return VerificarBiometriaArduinoResponse(
            tentativa_id=tentativa_id,
            usuario_id=usuario_id,
            local_id=local_id,
            aprovado=aprovado_final,
            similaridade=float(similaridade),
            comando="liberar" if aprovado_final else "negar",
            mensagem=(
                "Acesso autorizado."
                if aprovado_final
                else (motivo_final or "Acesso negado.")
            ),
        )


acesso_service = AcessoService()
