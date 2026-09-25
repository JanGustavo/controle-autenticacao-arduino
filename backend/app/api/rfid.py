from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

from app.schemas.rfid_schema import (
    CadastrarCartaoRequest,
    CadastrarCartaoResponse,
    ResultadoTentativaResponse,
    VerificarBiometriaArduinoResponse,
    VerificarCartaoRequest,
    VerificarCartaoResponse,
)
from app.auth.dependencies import obter_administrador_atual
from app.services.audit_service import audit_service
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


@router.post(
    "/verificar-cartao",
    response_model=VerificarCartaoResponse,
    summary="Validar RFID e iniciar tentativa",
    response_description="Tentativa PENDENTE criada para a etapa facial",
    responses={
        404: {"description": "Elegibilidade recusada pelo backend"},
        422: {"description": "Payload RFID inválido"},
        500: {"description": "Erro interno ao iniciar a tentativa"},
    },
)
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

        resultado = await acesso_service.iniciar_tentativa(
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
    summary="Validar face 1:1 e finalizar tentativa",
    response_description="Decisão final calculada pelo backend",
    responses={
        401: {"description": "JWT ausente, expirado ou inválido"},
        404: {"description": "Tentativa inexistente ou indisponível"},
        422: {"description": "tentativa_id ou upload inválido"},
        500: {"description": "Erro interno na validação facial"},
    },
)
async def verificar_face(
    tentativa_id: UUID = Query(...),
    file: UploadFile = File(...),
    _admin: dict = Depends(obter_administrador_atual),
):
    """
    Finaliza uma tentativa usando a câmera/backend.

    A comparação é estritamente 1:1: a face capturada é comparada
    somente com o vetor do usuário identificado pelo RFID.
    """
    try:
        image_bytes = await file.read()

        resultado = acesso_service.verificar_face_tentativa(
            tentativa_id,
            image_bytes,
        )

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
                    "motivo_recusa": (
                        None if resultado.aprovado else resultado.mensagem
                    ),
                    "data_hora": None,
                    "tentativa_id": str(resultado.tentativa_id),
                    "tempo_resposta_ms": resultado.tempo_resposta_ms,
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
        print(f"[FACE API Erro] {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao finalizar a validação facial.",
        ) from error


@router.get(
    "/resultado-acesso",
    response_model=ResultadoTentativaResponse,
    summary="Consultar decisão da tentativa",
    response_description="Comando que o ESP32 deve executar",
    responses={
        404: {"description": "Tentativa não pertence ao dispositivo informado"},
        422: {"description": "Parâmetros inválidos"},
        500: {"description": "Erro interno ao consultar a decisão"},
    },
)
async def resultado_acesso(
    tentativa_id: UUID = Query(...),
    identificador_dispositivo: str = Query(..., min_length=1),
):
    """
    Endpoint de polling do ESP32 para consultar a decisão FINAL do backend.

    O dispositivo informa apenas a tentativa e sua identidade lógica.
    Ele nunca envia campos como "aprovado" ou "similaridade".

    Enquanto a validação facial não terminar, o comando é "aguardar".
    A autenticação HMAC do dispositivo será adicionada em etapa posterior.
    """
    try:
        return acesso_service.obter_resultado_tentativa(
            tentativa_id=tentativa_id,
            identificador_dispositivo=identificador_dispositivo,
        )
    except TentativaAcessoNaoEncontradaError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except Exception as error:
        print(f"[RESULTADO ACESSO Erro] {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao consultar a decisão de acesso.",
        ) from error


@router.post(
    "/cadastrar-cartao",
    response_model=CadastrarCartaoResponse,
    summary="Vincular cartão RFID a um usuário",
    response_description="Cartão associado ao usuário",
    responses={
        400: {"description": "UID já associado ou regra de cadastro inválida"},
        401: {"description": "JWT administrativo ausente ou inválido"},
        404: {"description": "Usuário não encontrado"},
        422: {"description": "Payload inválido"},
        500: {"description": "Erro interno no cadastro do cartão"},
    },
)
async def cadastrar_cartao(
    dados: CadastrarCartaoRequest,
    request: Request,
    admin: dict = Depends(obter_administrador_atual),
):
    """
    Cadastra, substitui ou confirma o UID RFID de um usuário.

    O vínculo é uma ação administrativa auditada. O dispositivo informado
    representa o leitor usado para obter o cartão.
    """
    try:
        print(
            f"[CADASTRO] Dispositivo: {dados.identificador_dispositivo} "
            f"| UID: {dados.uid_card} -> User: {dados.usuario_id}"
        )
        resultado = rfid_service.cadastrar_cartao(
            identificador_dispositivo=dados.identificador_dispositivo,
            uid_card=dados.uid_card,
            usuario_id=dados.usuario_id,
        )

        audit_service.registrar(
            action="UPDATE_USER_RFID",
            admin_id=admin.get("admin_id"),
            resource_type="USER_RFID",
            resource_id=dados.usuario_id,
            description=(
                f"Cartão RFID atualizado para usuário {dados.usuario_id} "
                f"via {dados.identificador_dispositivo}"
            ),
            request=request,
        )

        return resultado
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
