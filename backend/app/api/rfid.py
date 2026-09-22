from fastapi import APIRouter, HTTPException, status
from app.schemas.rfid_schema import (
    VerificarCartaoRequest,
    VerificarCartaoResponse,
    CadastrarCartaoRequest,
    CadastrarCartaoResponse,
)
from app.services.rfid_service import (
    rfid_service,
    CartaoNaoEncontradoError,
    CartaoJaCadastradoError,
    UsuarioNaoEncontradoError,
)

router = APIRouter()


@router.post("/verificar-cartao", response_model=VerificarCartaoResponse)
async def verificar_cartao(request: VerificarCartaoRequest):
    try:
        print(
            f"[VERIFICAÇÃO] Dispositivo: {request.identificador_dispositivo} "
            f"| UID: {request.uid_card}"
        )
        return rfid_service.verificar_cartao(
            uid_card=request.uid_card,
            identificador_dispositivo=request.identificador_dispositivo,
        )

    except CartaoNaoEncontradoError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        print(f"[RFID API Erro] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno no servidor ao verificar o cartão: {str(e)}",
        )


@router.post("/cadastrar-cartao", response_model=CadastrarCartaoResponse)
async def cadastrar_cartao(request: CadastrarCartaoRequest):
    """
    Cadastra e vincula o UID lido pelo ESP32 a um usuario_id específico.
    """
    try:
        print(
            f"[CADASTRO] Dispositivo: {request.identificador_dispositivo} "
            f"| UID: {request.uid_card} -> User: {request.usuario_id}"
        )
        return rfid_service.cadastrar_cartao(
            identificador_dispositivo=request.identificador_dispositivo,
            uid_card=request.uid_card,
            usuario_id=request.usuario_id,
        )
    except CartaoJaCadastradoError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except UsuarioNaoEncontradoError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        print(f"[CADASTRO API Erro] {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao cadastrar cartão: {str(e)}",
        )