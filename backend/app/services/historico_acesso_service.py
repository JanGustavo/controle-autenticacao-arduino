from fastapi import HTTPException, status

from app.models.historico_acesso_model import historico_acesso_model
from app.schemas.historico_acesso_schema import HistoricoAcessoCreate


class HistoricoAcessoService:
    def listar_historico(
        self,
        q: str | None = None,
        usuario_id: int | None = None,
        local_id: int | None = None,
        autorizado: bool | None = None,
    ):
        return historico_acesso_model.listar(
            q=q,
            usuario_id=usuario_id,
            local_id=local_id,
            autorizado=autorizado,
        )

    def obter_historico(self, historico_id: int):
        registro = historico_acesso_model.buscar_por_id(historico_id)
        if registro is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registro de histórico não encontrado.",
            )
        return registro

    def criar_historico(self, registro: HistoricoAcessoCreate):
        return historico_acesso_model.criar(
            usuario_id=registro.usuario_id,
            local_id=registro.local_id,
            dispositivo_id=None,
            uid_card_lido=registro.uid_card_lido,
            data_hora=registro.data_hora,
            autorizado=registro.autorizado,
            percentual_similaridade=registro.percentual_similaridade,
            motivo_recusa=registro.motivo_recusa,
        )


historico_acesso_service = HistoricoAcessoService()
