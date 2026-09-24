from fastapi import HTTPException, status

from app.models.local_model import local_model
from app.schemas.local_schema import LocalCreate, LocalUpdate


class LocalService:
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
        return local_model.criar(
            nome=local.nome.strip(),
            ativo=local.ativo,
        )

    def atualizar_local(self, local_id: int, local: LocalUpdate):
        campos = local.model_dump(exclude_unset=True)
        if not campos:
            return self.obter_local(local_id)

        if "nome" in campos:
            campos["nome"] = campos["nome"].strip()

        atualizado = local_model.atualizar(local_id, campos)
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
