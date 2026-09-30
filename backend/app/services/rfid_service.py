from psycopg.errors import IntegrityError

from app.models.usuario_model import usuario_model
from app.schemas.rfid_schema import CadastrarCartaoResponse, ConsultarCartaoResponse


class RFIDServiceError(Exception):
    """Exceção base do serviço de RFID."""


class CartaoJaCadastradoError(RFIDServiceError):
    def __init__(
        self,
        message: str = "Este cartão já está cadastrado para outro usuário.",
    ):
        super().__init__(message)


class UsuarioNaoEncontradoError(RFIDServiceError):
    def __init__(self, message: str = "Usuário não encontrado."):
        super().__init__(message)


class RFIDService:
    @staticmethod
    def consultar_cartao(
        uid_card: str,
        usuario_id: int | None = None,
    ) -> ConsultarCartaoResponse:
        """
        Consulta se um UID já pertence a algum usuário.

        Em edição, o mesmo cartão do próprio usuário continua disponível;
        cartão pertencente a outro usuário é marcado como indisponível.
        """
        uid_normalizado = uid_card.strip().upper()
        dono = usuario_model.buscar_por_uid(uid_normalizado)

        if dono is None:
            return ConsultarCartaoResponse(
                uid_card=uid_normalizado,
                cadastrado=False,
                usuario_id=None,
                nome=None,
                disponivel_para_usuario=True,
                mensagem="Cartão disponível para cadastro.",
            )

        mesmo_usuario = (
            usuario_id is not None
            and dono["user_id"] == usuario_id
        )

        if mesmo_usuario:
            return ConsultarCartaoResponse(
                uid_card=uid_normalizado,
                cadastrado=True,
                usuario_id=dono["user_id"],
                nome=dono["nome"],
                disponivel_para_usuario=True,
                mensagem="Cartão já está associado a este usuário.",
            )

        return ConsultarCartaoResponse(
            uid_card=uid_normalizado,
            cadastrado=True,
            usuario_id=dono["user_id"],
            nome=dono["nome"],
            disponivel_para_usuario=False,
            mensagem=(
                f"Cartão já está associado ao usuário {dono['nome']} "
                f"(ID {dono['user_id']})."
            ),
        )

    @staticmethod
    def cadastrar_cartao(
        identificador_dispositivo: str,
        uid_card: str,
        usuario_id: int,
    ) -> CadastrarCartaoResponse:
        """
        Associa um UID ao usuário.

        A verificação de acesso não fica mais neste serviço. A única fonte
        de verdade desse fluxo é AcessoService.
        """
        usuario = usuario_model.buscar_por_id(usuario_id)

        if usuario is None:
            raise UsuarioNaoEncontradoError(
                f"Usuário com ID {usuario_id} não existe no sistema."
            )

        if usuario["uid_card"] == uid_card:
            return CadastrarCartaoResponse(
                sucesso=True,
                usuario_id=usuario_id,
                uid_card=uid_card,
                mensagem="Cartão já estava associado a este usuário.",
            )

        dono_existente = usuario_model.buscar_por_uid(uid_card)
        if dono_existente is not None and dono_existente["user_id"] != usuario_id:
            raise CartaoJaCadastradoError(
                f"Este cartão ({uid_card}) já está associado a outro usuário."
            )

        try:
            atualizado = usuario_model.atualizar(
                usuario_id,
                {"uid_card": uid_card},
            )
        except IntegrityError as error:
            # A constraint UNIQUE continua sendo a proteção real contra
            # duas requisições concorrentes tentando usar o mesmo UID.
            raise CartaoJaCadastradoError(
                f"Este cartão ({uid_card}) já está associado a outro usuário."
            ) from error

        if atualizado is None:
            raise UsuarioNaoEncontradoError(
                f"Usuário com ID {usuario_id} não existe no sistema."
            )

        return CadastrarCartaoResponse(
            sucesso=True,
            usuario_id=usuario_id,
            uid_card=uid_card,
            mensagem=(
                f"Cartão {uid_card} associado com sucesso ao usuário {usuario_id} "
                f"via {identificador_dispositivo}."
            ),
        )


rfid_service = RFIDService()
