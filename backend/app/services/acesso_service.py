import json
import os
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from app.database.connection import get_connection
from app.models.dispositivo_model import dispositivo_model
from app.models.historico_acesso_model import historico_acesso_model
from app.models.local_model import local_model
from app.models.permissao_model import permissao_model
from app.models.tentativa_acesso_model import tentativa_acesso_model
from app.models.usuario_model import usuario_model
from app.schemas.rfid_schema import (
    ResultadoTentativaResponse,
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

    A regra de negócio permanece aqui. Persistência fica nos Models.
    Nenhuma transação permanece aberta durante a espera da biometria.
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
            dentro_horario = hora_atual >= horario_inicio or hora_atual <= horario_fim

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
        RFID -> dispositivo -> usuário -> permissão -> tentativa PENDENTE.

        Consultas e gravações ficam nos Models; este método mantém apenas
        a decisão de negócio e a coordenação do fluxo.
        """
        agora = cls._agora()
        timeout_segundos = int(os.getenv("ACCESS_ATTEMPT_TIMEOUT_SECONDS", "15"))
        tentativa_id = uuid4()

        dispositivo = dispositivo_model.buscar_por_identificador(
            identificador_dispositivo
        )
        local = (
            local_model.buscar_por_id(dispositivo["local_id"])
            if dispositivo
            else None
        )
        usuario = usuario_model.buscar_por_uid(uid_card)

        dispositivo_id = (
            dispositivo["dispositivo_id"] if dispositivo else None
        )
        local_id = local["local_id"] if local else None
        usuario_id = usuario["user_id"] if usuario else None

        negacao: str | None = None

        if not dispositivo:
            negacao = "Dispositivo não cadastrado no sistema."
        elif not dispositivo["ativo"]:
            negacao = "Dispositivo desativado."
        elif not local:
            negacao = "Local do dispositivo não encontrado."
        elif not local["ativo"]:
            negacao = "Local desativado."
        elif not usuario:
            negacao = "Cartão não cadastrado no sistema."
        elif not usuario["ativo"]:
            negacao = "Usuário inativo."
        else:
            permissao = permissao_model.buscar_por_usuario_local(
                usuario_id,
                local_id,
            )

            if not permissao:
                negacao = "Usuário sem permissão para este local."
            else:
                permitido, motivo = cls._permissao_valida(
                    permissao["horario_inicio"],
                    permissao["horario_fim"],
                    list(permissao["dias_semana"]),
                    agora,
                )
                if not permitido:
                    negacao = motivo or "Acesso fora da permissão."

        if negacao:
            historico_acesso_model.criar(
                usuario_id=usuario_id,
                local_id=local_id,
                dispositivo_id=dispositivo_id,
                uid_card_lido=uid_card,
                data_hora=agora,
                autorizado=False,
                percentual_similaridade=None,
                motivo_recusa=negacao,
            )
            raise AcessoNegadoError(negacao)

        expira_em = agora + timedelta(seconds=timeout_segundos)

        with get_connection() as connection:
            with connection.cursor() as cursor:
                tentativa_acesso_model.criar_com_cursor(
                    cursor,
                    tentativa_id=tentativa_id,
                    usuario_id=usuario_id,
                    local_id=local_id,
                    dispositivo_id=dispositivo_id,
                    uid_card_lido=uid_card,
                    status=cls._STATUS_PENDENTE,
                    criado_em=agora,
                    expira_em=expira_em,
                )

        return VerificarCartaoResponse(
            existe=True,
            tentativa_id=tentativa_id,
            usuario_id=usuario_id,
            nome=usuario["nome"],
            mensagem=(
                "Cartão reconhecido e dentro da permissão. "
                "Aguardando validação facial."
            ),
            proxima_etapa="BIOMETRIA",
        )

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
        Validação facial estrita 1:1.

        Compara o rosto capturado EXCLUSIVAMENTE contra o vetor facial
        do usuário previamente identificado e validado pelo cartão RFID (RF04).
        """
        tentativa = tentativa_acesso_model.buscar_por_id(tentativa_id)

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

        # Busca EXCLUSIVAMENTE o usuário vinculado a esta tentativa (1:1)
        usuario = usuario_model.buscar_por_id(tentativa["usuario_id"])
        if not usuario or not usuario.get("vetor_facial"):
            return cls._finalizar_tentativa(
                tentativa_id=tentativa_id,
                aprovado=False,
                similaridade=0.0,
                motivo_recusa="Usuário não possui biometria facial cadastrada no sistema.",
            )

        vetor_esperado = cls._normalizar_vetor(usuario["vetor_facial"])
        if vetor_esperado is None:
            return cls._finalizar_tentativa(
                tentativa_id=tentativa_id,
                aprovado=False,
                similaridade=0.0,
                motivo_recusa="Vetor biométrico cadastrado do usuário é inválido.",
            )

        # Comparação direta 1:1 (vetor do usuário x vetor da face detectada)
        resultado_sim = FaceService.calculate_similarity(
            vetor_esperado,
            face_result.vector,
        )

        aprovado = resultado_sim.is_match
        motivo = None if aprovado else "Similaridade facial insuficiente com o titular do cartão."

        # Similaridade de cosseno varia entre -1.0 e 1.0, mas o schema de resposta/histórico
        # e as regras de negócio de match tratam similaridades menores que 0 como 0.0 (sem correlação/opostas)
        sim_val = max(0.0, min(1.0, resultado_sim.similarity))

        return cls._finalizar_tentativa(
            tentativa_id=tentativa_id,
            aprovado=aprovado,
            similaridade=sim_val,
            motivo_recusa=motivo,
        )

    @classmethod
    def obter_resultado_tentativa(
        cls,
        tentativa_id: UUID,
        identificador_dispositivo: str,
    ) -> ResultadoTentativaResponse:
        """
        Retorna somente a decisão calculada pelo backend para o dispositivo
        que originou a tentativa.

        O cliente físico nunca informa "aprovado". Enquanto a biometria
        ainda não terminou, recebe comando "aguardar".
        """
        resultado = tentativa_acesso_model.buscar_resultado_por_dispositivo(
            tentativa_id,
            identificador_dispositivo,
        )

        if resultado is None:
            raise TentativaAcessoNaoEncontradaError(
                "Tentativa não encontrada para este dispositivo."
            )

        status_tentativa = resultado["status"]
        similaridade = float(resultado["percentual_similaridade"] or 0.0)

        if status_tentativa == cls._STATUS_PENDENTE:
            return ResultadoTentativaResponse(
                tentativa_id=tentativa_id,
                status=status_tentativa,
                comando="aguardar",
                aprovado=None,
                similaridade=similaridade,
                mensagem="Validação facial ainda em andamento.",
                tempo_resposta_ms=None,
            )

        aprovado = status_tentativa == cls._STATUS_AUTORIZADO
        comando = "liberar" if aprovado else "negar"
        mensagem = (
            "Acesso autorizado."
            if aprovado
            else (
                resultado["motivo_recusa"]
                or (
                    "Tentativa expirada."
                    if status_tentativa == cls._STATUS_EXPIRADO
                    else "Acesso negado."
                )
            )
        )

        tempo_resposta_ms = None
        if resultado["criado_em"] and resultado["concluido_em"]:
            delta = resultado["concluido_em"] - resultado["criado_em"]
            tempo_resposta_ms = max(
                0,
                int(delta.total_seconds() * 1000),
            )

        return ResultadoTentativaResponse(
            tentativa_id=tentativa_id,
            status=status_tentativa,
            comando=comando,
            aprovado=aprovado,
            similaridade=similaridade,
            mensagem=mensagem,
            tempo_resposta_ms=tempo_resposta_ms,
        )

    @classmethod
    def _finalizar_tentativa(
        cls,
        tentativa_id: UUID,
        aprovado: bool,
        similaridade: float,
        motivo_recusa: str | None,
    ) -> VerificarBiometriaArduinoResponse:
        """
        Finaliza tentativa em uma única transação curta.

        O Model executa SELECT/UPDATE/INSERT; o Service decide o resultado.
        """
        agora = cls._agora()

        with get_connection() as connection:
            with connection.cursor() as cursor:
                contexto = tentativa_acesso_model.buscar_contexto_finalizacao_com_cursor(
                    cursor,
                    tentativa_id,
                )

                if contexto is None:
                    raise TentativaAcessoNaoEncontradaError(
                        "Tentativa de acesso não encontrada."
                    )

                usuario_id = contexto["usuario_id"]
                local_id = contexto["local_id"]
                uid_card = contexto["uid_card_lido"]
                nome_usuario = contexto["nome_usuario"]

                if contexto["status"] != cls._STATUS_PENDENTE:
                    estado = tentativa_acesso_model.buscar_estado_com_cursor(
                        cursor,
                        tentativa_id,
                    )

                    aprovado_final = (
                        bool(estado)
                        and estado["status"] == cls._STATUS_AUTORIZADO
                    )
                    similaridade_final = (
                        float(estado["percentual_similaridade"] or 0.0)
                        if estado
                        else 0.0
                    )
                    mensagem = (
                        estado["motivo_recusa"]
                        if estado and estado["motivo_recusa"]
                        else "Tentativa já finalizada."
                    )

                    return VerificarBiometriaArduinoResponse(
                        tentativa_id=tentativa_id,
                        usuario_id=usuario_id,
                        nome=nome_usuario,
                        local_id=local_id,
                        aprovado=aprovado_final,
                        similaridade=similaridade_final,
                        comando="liberar" if aprovado_final else "negar",
                        mensagem=mensagem,
                    )

                if agora > contexto["expira_em"]:
                    status_final = cls._STATUS_EXPIRADO
                    motivo_final = "Tempo máximo para validação facial excedido."
                    aprovado_final = False
                elif not contexto["usuario_ativo"]:
                    status_final = cls._STATUS_NEGADO
                    motivo_final = "Usuário está inativo."
                    aprovado_final = False
                elif not contexto["local_ativo"]:
                    status_final = cls._STATUS_NEGADO
                    motivo_final = "Local está inativo."
                    aprovado_final = False
                elif not contexto["dispositivo_ativo"]:
                    status_final = cls._STATUS_NEGADO
                    motivo_final = "Dispositivo está inativo."
                    aprovado_final = False
                elif (
                    not contexto["horario_inicio"]
                    or not contexto["horario_fim"]
                    or not contexto["dias_semana"]
                ):
                    status_final = cls._STATUS_NEGADO
                    motivo_final = (
                        "Permissão de acesso não encontrada no momento da validação."
                    )
                    aprovado_final = False
                else:
                    permitido, motivo_permissao = cls._permissao_valida(
                        contexto["horario_inicio"],
                        contexto["horario_fim"],
                        list(contexto["dias_semana"]),
                        agora,
                    )

                    if not permitido:
                        status_final = cls._STATUS_NEGADO
                        motivo_final = motivo_permissao or "Acesso fora da permissão."
                        aprovado_final = False
                    elif not aprovado:
                        status_final = cls._STATUS_NEGADO
                        motivo_final = motivo_recusa or "Biometria recusada."
                        aprovado_final = False
                    else:
                        status_final = cls._STATUS_AUTORIZADO
                        motivo_final = None
                        aprovado_final = True

                tentativa_acesso_model.finalizar_com_cursor(
                    cursor,
                    tentativa_id=tentativa_id,
                    status=status_final,
                    concluido_em=agora,
                    percentual_similaridade=float(similaridade),
                    motivo_recusa=motivo_final,
                )

                historico_acesso_model.criar_com_cursor(
                    cursor,
                    usuario_id=usuario_id,
                    local_id=local_id,
                    dispositivo_id=contexto["dispositivo_id"],
                    uid_card_lido=uid_card,
                    data_hora=agora,
                    autorizado=aprovado_final,
                    percentual_similaridade=float(similaridade),
                    motivo_recusa=motivo_final,
                )

        tempo_resposta_ms: int | None = None
        criado_em = contexto.get("criado_em")
        if criado_em:
            delta = agora - criado_em
            tempo_resposta_ms = max(0, int(delta.total_seconds() * 1000))

        return VerificarBiometriaArduinoResponse(
            tentativa_id=tentativa_id,
            usuario_id=usuario_id,
            nome=nome_usuario,
            local_id=local_id,
            aprovado=aprovado_final,
            similaridade=float(similaridade),
            comando="liberar" if aprovado_final else "negar",
            mensagem=(
                "Acesso autorizado."
                if aprovado_final
                else (motivo_final or "Acesso negado.")
            ),
            tempo_resposta_ms=tempo_resposta_ms,
        )


acesso_service = AcessoService()
