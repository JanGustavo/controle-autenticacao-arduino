import datetime

from app.database.connection import get_connection
from app.schemas.rfid_schema import VerificarCartaoResponse, CadastrarCartaoResponse

# --- Exceções Customizadas de Negócio ---
class RFIDServiceError(Exception):
    """Exceção base do serviço de RFID."""
    pass


class CartaoNaoEncontradoError(RFIDServiceError):
    def __init__(self, message: str = "Cartão não cadastrado no sistema."):
        super().__init__(message)


class CartaoJaCadastradoError(RFIDServiceError):
    def __init__(self, message: str = "Este cartão já está cadastrado para outro usuário."):
        super().__init__(message)


class UsuarioNaoEncontradoError(RFIDServiceError):
    def __init__(self, message: str = "Usuário não encontrado."):
        super().__init__(message)


class RFIDService:
    @staticmethod
    def verificar_cartao(uid_card: str, identificador_dispositivo: str) -> VerificarCartaoResponse:
        """
        Verifica se o cartão está cadastrado e se o usuário tem permissão para acessar o local.
        Valida o cartão E a permissão para o local específico que fez a
        requisição -- antes esta consulta só checava se o cartão existia
        em algum lugar, o que abria qualquer porta com qualquer cartão
        válido, ignorando a tabela `permissao` (local + horário + dias).
        """
        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT u.user_id, u.nome, p.horario_inicio, p.horario_fim, p.dias_semana
                        FROM usuario u
                        JOIN permissao p ON p.usuario_id = u.user_id
                        JOIN local l ON l.local_id = p.local_id
                        WHERE u.uid_card = %s
                          AND l.identificador_dispositivo = %s
                          AND u.ativo = TRUE
                        """,
                        (uid_card, identificador_dispositivo),
                    )
                    resultado = cursor.fetchone()

            if not resultado:
                raise CartaoNaoEncontradoError(
                    "Cartão inválido, usuário inativo, ou sem permissão cadastrada para este local."
                )

            usuario_id, nome, horario_inicio, horario_fim, dias_semana = resultado

            agora = datetime.datetime.now()
            hora_atual = agora.time()
            # Convenção usada no init.sql (seed): 1=Domingo ... 7=Sábado.
            # isoweekday() do Python é 1=Segunda ... 7=Domingo, daí o ajuste.
            dia_atual = (agora.isoweekday() % 7) + 1

            if dia_atual not in dias_semana:
                raise CartaoNaoEncontradoError(
                    "Cartão válido, mas fora dos dias de acesso permitidos para este usuário."
                )

            if not (horario_inicio <= hora_atual <= horario_fim):
                raise CartaoNaoEncontradoError(
                    "Cartão válido, mas fora do horário de acesso permitido para este usuário."
                )

            return VerificarCartaoResponse(
                existe=True,
                usuario_id=usuario_id,
                nome=nome,
                mensagem="Cartão reconhecido e dentro da permissão. Aguardando validação facial.",
            )

        except RFIDServiceError:
            raise
        except Exception as e:
            print(f"[RFIDService] Erro ao consultar banco: {e}")
            raise e

    @staticmethod
    def cadastrar_cartao(
        identificador_dispositivo: str, uid_card: str, usuario_id: int
    ) -> CadastrarCartaoResponse:
        """
        Idempotente: recadastrar o mesmo UID pro mesmo usuário não é erro.
        A checagem de "cartão já pertence a outro usuário" agora conta com
        a constraint UNIQUE de uid_card no banco como rede de segurança
        contra corrida entre requisições concorrentes -- o SELECT prévio
        sozinho não garante isso (duas requisições podem passar pelo
        SELECT antes de qualquer uma delas commitar o UPDATE).
        """
        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT uid_card FROM usuario WHERE user_id = %s", (usuario_id,)
                    )
                    row = cursor.fetchone()

                    if row is None:
                        raise UsuarioNaoEncontradoError(
                            f"Usuário com ID {usuario_id} não existe no sistema."
                        )

                    if row[0] == uid_card:
                        return CadastrarCartaoResponse(
                            sucesso=True,
                            usuario_id=usuario_id,
                            uid_card=uid_card,
                            mensagem="Cartão já estava associado a este usuário.",
                        )

                    cursor.execute(
                        "SELECT user_id FROM usuario WHERE uid_card = %s", (uid_card,)
                    )
                    dono_existente = cursor.fetchone()
                    if dono_existente:
                        raise CartaoJaCadastradoError(
                            f"Este cartão ({uid_card}) já está associado a outro usuário."
                        )

                    cursor.execute(
                        "UPDATE usuario SET uid_card = %s WHERE user_id = %s",
                        (uid_card, usuario_id),
                    )
                    connection.commit()

            return CadastrarCartaoResponse(
                sucesso=True,
                usuario_id=usuario_id,
                uid_card=uid_card,
                mensagem=(
                    f"Cartão {uid_card} associado com sucesso ao usuário {usuario_id} "
                    f"via {identificador_dispositivo}."
                ),
            )

        except RFIDServiceError:
            raise
        except Exception as e:
            # psycopg.errors.UniqueViolation cai aqui se duas requisições
            # concorrentes tentarem cadastrar o mesmo UID ao mesmo tempo
            # (o SELECT acima reduz a janela, mas o UNIQUE do banco é
            # quem garante a integridade de verdade nesse caso raro).
            print(f"[RFIDService] Erro no cadastro do cartão: {e}")
            raise e


rfid_service = RFIDService()