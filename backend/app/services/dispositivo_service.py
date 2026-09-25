from fastapi import HTTPException, status
from psycopg.errors import ForeignKeyViolation, IntegrityError

from app.models.dispositivo_model import dispositivo_model
from app.schemas.dispositivo_schema import DispositivoCreate, DispositivoUpdate


class DispositivoService:
    @staticmethod
    def _normalizar_identificador(identificador: str) -> str:
        return identificador.strip().upper()

    def listar_dispositivos(
        self,
        q: str | None = None,
        local_id: int | None = None,
        ativo: bool | None = None,
    ):
        return dispositivo_model.listar(q=q, local_id=local_id, ativo=ativo)

    def listar_dispositivos_simples(self, q: str | None = None, ativo: bool | None = None):
        """Lista dispositivos sem JOIN com local (para dropdowns/seletores)."""
        return dispositivo_model.listar_simples(q=q, ativo=ativo)

    def obter_dispositivo(self, dispositivo_id: int):
        dispositivo = dispositivo_model.buscar_por_id(dispositivo_id)
        if dispositivo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispositivo não encontrado.",
            )
        return dispositivo

    def criar_dispositivo(self, dispositivo: DispositivoCreate):
        try:
            return dispositivo_model.criar(
                local_id=dispositivo.local_id,
                nome=dispositivo.nome.strip(),
                identificador=self._normalizar_identificador(
                    dispositivo.identificador
                ),
                ativo=dispositivo.ativo,
            )
        except ForeignKeyViolation as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local não encontrado.",
            ) from error
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este identificador de dispositivo já está cadastrado.",
            ) from error

    def atualizar_dispositivo(
        self,
        dispositivo_id: int,
        dispositivo: DispositivoUpdate,
    ):
        campos = dispositivo.model_dump(exclude_unset=True)
        if not campos:
            return self.obter_dispositivo(dispositivo_id)

        if "nome" in campos:
            campos["nome"] = campos["nome"].strip()
        if "identificador" in campos:
            campos["identificador"] = self._normalizar_identificador(
                campos["identificador"]
            )

        try:
            atualizado = dispositivo_model.atualizar(dispositivo_id, campos)
        except ForeignKeyViolation as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Local não encontrado.",
            ) from error
        except IntegrityError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este identificador de dispositivo já está cadastrado.",
            ) from error

        if atualizado is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispositivo não encontrado.",
            )
        return atualizado

    def deletar_dispositivo(self, dispositivo_id: int):
        if not dispositivo_model.deletar(dispositivo_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispositivo não encontrado.",
            )
        return {"mensagem": "Dispositivo excluído com sucesso."}


dispositivo_service = DispositivoService()
