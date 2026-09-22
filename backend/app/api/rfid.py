from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.schemas.rfid_schema import (
    CadastrarCartaoRequest,
    CadastrarCartaoResponse,
    VerificarBiometriaArduinoRequest,
    VerificarBiometriaArduinoResponse,
    VerificarCartaoRequest,
    VerificarCartaoResponse,
)
from app.services.acesso_service import (
    AcessoNegadoError,
    TentativaAcessoNaoEncontradaError,
    acesso_service,
)
from app.schemas.websocket_schema import manager
from app.services.rfid_service import (
    CartaoJaCadastradoError,
    UsuarioNaoEncontradoError,
    rfid_service,
)

router = APIRouter()


@router.post("/verificar-cartao", response_model=VerificarCartaoResponse)
async def verificar_cartao(request: VerificarCartaoRequest):
    """
    Inicia uma tentativa real de acesso.

    Valida RFID + local/dispositivo + usuário + permissão de horário/dia.
    Se tudo estiver correto, cria uma tentativa PENDENTE para a biometria.
    """
    try:
        print(
            f"[VERIFICAÇÃO] Dispositivo: {request.identificador_dispositivo} "
            f"| UID: {request.uid_card}"
        )
        await manager.broadcast(
            {
                "type": "RFID_LIDO",
                "data": {
                    "uid_card": request.uid_card,
                    "identificador_dispositivo": request.identificador_dispositivo,
                },
            }
        )

        resultado = acesso_service.iniciar_tentativa(
            uid_card=request.uid_card,
            identificador_dispositivo=request.identificador_dispositivo,
        )

        await manager.broadcast(
            {
                "type": "RFID_APROVADO",
                "data": {
                    "tentativa_id": str(resultado.tentativa_id),
                    "usuario_id": resultado.usuario_id,
                    "nome_usuario": resultado.nome,
                    "identificador_dispositivo": request.identificador_dispositivo,
                },
            }
        )

        return resultado

    except AcessoNegadoError as error:
        await manager.broadcast(
            {
                "type": "RFID_NEGADO",
                "data": {
                    "uid_card": request.uid_card,
                    "identificador_dispositivo": request.identificador_dispositivo,
                    "motivo": str(error),
                },
            }
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except Exception as error:
        print(f"[RFID API Erro] {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno no servidor ao verificar o cartão.",
        ) from error


@router.post(
    "/verificar-face",
    response_model=VerificarBiometriaArduinoResponse,
)
async def verificar_face(
    tentativa_id: UUID = Query(...),
    file: UploadFile = File(...),
):
    """
    Finaliza uma tentativa usando a câmera/backend.

    Nesta fase, a comparação ainda é 1:N. A aprovação só ocorre quando
    o melhor candidato é o mesmo usuário identificado pelo RFID.
    """
    try:
        image_bytes = await file.read()
        return acesso_service.verificar_face_tentativa(
            tentativa_id,
            image_bytes,
        )
    except TentativaAcessoNaoEncontradaError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except Exception as error:
        print(f"[FACE API Erro] {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao finalizar a validação facial.",
        ) from error


@router.post(
    "/resultado-biometria",
    response_model=VerificarBiometriaArduinoResponse,
)
async def resultado_biometria(
    request: VerificarBiometriaArduinoRequest,
):
    """
    Recebe o resultado do módulo facial do hardware.

    Temporariamente localiza a tentativa PENDENTE mais recente do mesmo
    cartão + dispositivo. Quando o módulo 1:1 estiver pronto, o contrato
    poderá passar a usar tentativa_id diretamente.
    """
    try:
        resultado = acesso_service.finalizar_resultado_arduino(request)

        await manager.broadcast(
            {
                "type": "NOVO_ACESSO",
                "data": {
                    "id": None,
                    "usuario_id": resultado.usuario_id,
                    "nome_usuario": resultado.nome,
                    "local_id": resultado.local_id,
                    "autorizado": resultado.aprovado,
                    "percentual_similaridade": resultado.similaridade,
                    "motivo_recusa": None if resultado.aprovado else resultado.mensagem,
                    "data_hora": None,
                    "tentativa_id": str(resultado.tentativa_id),
                },
            }
        )

        return resultado
    except TentativaAcessoNaoEncontradaError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except Exception as error:
        print(f"[BIOMETRIA API Erro] {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao registrar o resultado da biometria.",
        ) from error


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
    except CartaoJaCadastradoError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except UsuarioNaoEncontradoError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except Exception as error:
        print(f"[CADASTRO API Erro] {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao cadastrar cartão.",
        ) from error
