from fastapi import HTTPException, status
from psycopg.errors import IntegrityError

from app.models.local_model import local_model
from app.schemas.local_schema import LocalCreate, LocalUpdate


class LocalService:
    @staticmethod
    def _normalizar_dispositivo(identificador: str) -> str:
        return identificador.strip().upper()

    def listar_locais(self, q: str | None = None, ativo: bool | None = None):
        return local_model.listar(q=q, ativo=ativo)

    def obter_local(self, local_id: int):
        local = local_model.buscar_por_id(local_id)
        if local is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local não encontrado.",
            )
        return local

    def criar_local(self, local: LocalCreate):
        try:
            return local_model.criar(
                nome=local.nome.strip(),
                identificador_dispositivo=self._normalizar_dispositivo(
                    local.identificador_dispositivo
                ),
                ativo=local.ativo,
            )
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este identificador de dispositivo já está cadastrado.",
            ) from error

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

        try:
            atualizado = local_model.atualizar(local_id, campos)
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este identificador de dispositivo já está cadastrado.",
            ) from error

        if atualizado is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local não encontrado.",
            )
        return atualizado

    def deletar_local(self, local_id: int):
        if not local_model.deletar(local_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local não encontrado.",
            )
        return {"mensagem": "Local excluído com sucesso."}


local_service = LocalService()
