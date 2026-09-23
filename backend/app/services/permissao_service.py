from fastapi import HTTPException, status
from psycopg.errors import ForeignKeyViolation, IntegrityError

from app.models.permissao_model import permissao_model
from app.schemas.permissao_schema import PermissaoCreate, PermissaoUpdate


class PermissaoService:
    def listar_permissoes(
        self,
        q: str | None = None,
        usuario_id: int | None = None,
        local_id: int | None = None,
    ):
        return permissao_model.listar(
            q=q,
            usuario_id=usuario_id,
            local_id=local_id,
        )

    def obter_permissao(self, permissao_id: int):
        permissao = permissao_model.buscar_por_id(permissao_id)
        if permissao is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permissão não encontrada.",
            )
        return permissao

    def criar_permissao(self, permissao: PermissaoCreate):
        try:
            return permissao_model.criar(
                usuario_id=permissao.usuario_id,
                local_id=permissao.local_id,
                horario_inicio=permissao.horario_inicio,
                horario_fim=permissao.horario_fim,
                dias_semana=permissao.dias_semana,
            )
        except ForeignKeyViolation as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário ou local não encontrado.",
            ) from error
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe uma permissão para este usuário e local.",
            ) from error

    def atualizar_permissao(
        self,
        permissao_id: int,
        permissao: PermissaoUpdate,
    ):
        campos = permissao.model_dump(exclude_unset=True)
        if not campos:
            return self.obter_permissao(permissao_id)

        try:
            atualizada = permissao_model.atualizar(permissao_id, campos)
        except ForeignKeyViolation as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local não encontrado.",
            ) from error
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe uma permissão para este usuário e local.",
            ) from error

        if atualizada is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permissão não encontrada.",
            )
        return atualizada

    def deletar_permissao(self, permissao_id: int):
        if not permissao_model.deletar(permissao_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permissão não encontrada.",
            )
        return {"mensagem": "Permissão excluída com sucesso."}


permissao_service = PermissaoService()
