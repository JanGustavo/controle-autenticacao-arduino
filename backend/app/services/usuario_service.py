import re

from fastapi import HTTPException, status
from psycopg.errors import IntegrityError

from app.database.connection import get_connection
from app.models.permissao_model import permissao_model
from app.models.usuario_model import usuario_model
from app.schemas.usuario_schema import UsuarioCreate, UsuarioUpdate


class UsuarioService:
    @staticmethod
    def _normalizar_uid(uid_card: str | None) -> str | None:
        if uid_card is None:
            return None
        return re.sub(r"[\s:-]", "", uid_card).upper() or None

    def listar_usuarios(self, q: str | None = None, ativo: bool | None = None):
        return usuario_model.listar(q=q, ativo=ativo)

    def obter_usuario(self, usuario_id: int):
        usuario = usuario_model.buscar_por_id(usuario_id)
        if usuario is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado.",
            )
        return usuario

    def criar_usuario(self, usuario: UsuarioCreate):
        try:
            # A criação do usuário e de suas permissões continua atômica.
            # O Service coordena a transação; os Models concentram o SQL.
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    criado = usuario_model.criar_com_cursor(
                        cursor,
                        nome=usuario.nome,
                        uid_card=self._normalizar_uid(usuario.uid_card),
                        vetor_facial=usuario.vetor_facial,
                        ativo=usuario.ativo,
                    )

                    for permissao in usuario.permissoes:
                        permissao_model.criar_com_cursor(
                            cursor,
                            usuario_id=criado["user_id"],
                            local_id=permissao.local_id,
                            horario_inicio=permissao.horario_inicio,
                            horario_fim=permissao.horario_fim,
                            dias_semana=permissao.dias_semana,
                        )

            return criado
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="O cartão informado já está cadastrado.",
            ) from error

    def atualizar_usuario(self, usuario_id: int, usuario: UsuarioUpdate):
        campos = usuario.model_dump(exclude_unset=True)
        if not campos:
            return self.obter_usuario(usuario_id)

        if "uid_card" in campos:
            campos["uid_card"] = self._normalizar_uid(campos["uid_card"])

        try:
            atualizado = usuario_model.atualizar(usuario_id, campos)
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="O cartão informado já está cadastrado.",
            ) from error

        if atualizado is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado.",
            )
        return atualizado

    def atualizar_vetor_facial(
        self,
        usuario_id: int,
        vetor_facial: list[float],
    ):
        if not usuario_model.atualizar_vetor_facial(usuario_id, vetor_facial):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado.",
            )
        return usuario_id

    def deletar_usuario(self, usuario_id: int):
        if not usuario_model.deletar(usuario_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado.",
            )
        return {"mensagem": "Usuário excluído com sucesso."}


usuario_service = UsuarioService()
