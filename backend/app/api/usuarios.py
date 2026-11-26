from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, HTTPException, status
from pydantic import ValidationError

from app.auth.dependencies import obter_administrador_atual
from app.schemas.usuario_schema import UsuarioCreate, UsuarioResponse, UsuarioSimplesResponse, UsuarioUpdate
from app.services.usuario_service import usuario_service
from app.services.audit_service import audit_service

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


@router.get(
    "/usuarios",
    response_model=list[UsuarioResponse],
    summary="Listar usuários",
)
def listar_usuarios(q: str | None = None, ativo: bool | None = None):
    return usuario_service.listar_usuarios(q=q, ativo=ativo)


@router.get(
    "/usuarios/simples",
    response_model=list[UsuarioSimplesResponse],
    summary="Listar usuários (versão leve para dropdowns)",
)
def listar_usuarios_simples(q: str | None = None, ativo: bool | None = None):
    return usuario_service.listar_usuarios_simples(q=q, ativo=ativo)


@router.get(
    "/usuarios/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Obter usuário para consulta ou edição",
    responses={404: {"description": "Usuário não encontrado"}},
)
def obter_usuario(usuario_id: int):
    return usuario_service.obter_usuario(usuario_id)

@router.post(
    "/usuarios",
    response_model=UsuarioResponse,
    summary="Criar usuário",
    responses={409: {"description": "Conflito de cartão ou dados únicos"}},
)
def criar_usuario(usuario: UsuarioCreate, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = usuario_service.criar_usuario(usuario)
    audit_service.registrar(
        action="CREATE_USER",
        admin_id=admin.get("admin_id"),
        resource_type="USER",
        resource_id=resultado["user_id"],
        description=f"Usuário {usuario.nome} criado",
        request=request
    )
    return resultado


@router.post(
    "/usuarios/cadastro-completo",
    response_model=UsuarioResponse,
    summary="Criar usuário com cartão, biometria e permissões de forma atômica",
    responses={
        400: {"description": "Nenhum rosto válido foi detectado"},
        409: {"description": "CPF ou cartão já cadastrado"},
        422: {"description": "Dados, leitor ou imagem inválidos"},
    },
)
async def criar_usuario_completo(
    request: Request,
    dados: str = Form(...),
    identificador_dispositivo: str = Form(...),
    file: UploadFile = File(...),
    admin: dict = Depends(obter_administrador_atual),
):
    try:
        usuario = UsuarioCreate.model_validate_json(dados)
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error.errors(),
        ) from error

    imagem = await file.read()
    resultado = usuario_service.criar_usuario_completo(
        usuario,
        imagem,
        identificador_dispositivo,
    )
    audit_service.registrar(
        action="CREATE_USER",
        admin_id=admin.get("admin_id"),
        resource_type="USER",
        resource_id=resultado["user_id"],
        description=f"Usuário {usuario.nome} criado com cartão e biometria",
        request=request,
    )
    return resultado

@router.delete(
    "/usuarios/{usuario_id}",
    summary="Excluir usuário",
    responses={404: {"description": "Usuário não encontrado"}},
)
def deletar_usuario(usuario_id: int, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = usuario_service.deletar_usuario(usuario_id)
    audit_service.registrar(
        action="DELETE_USER",
        admin_id=admin.get("admin_id"),
        resource_type="USER",
        resource_id=usuario_id,
        description="Usuário excluído",
        request=request
    )
    return resultado

@router.patch(
    "/usuarios/{usuario_id}",
    response_model=UsuarioResponse,
    summary="Editar dados cadastrais do usuário",
    description=(
        "Atualiza nome, CPF, tipo e status. Use /arduino/cadastrar-cartao "
        "para trocar RFID e /biometria/cadastrar/{usuario_id} para biometria."
    ),
    responses={404: {"description": "Usuário não encontrado"}},
)
def atualizar_usuario(usuario_id: int, usuario: UsuarioUpdate, request: Request, admin: dict = Depends(obter_administrador_atual)):
    resultado = usuario_service.atualizar_usuario(usuario_id, usuario)
    audit_service.registrar(
        action="UPDATE_USER",
        admin_id=admin.get("admin_id"),
        resource_type="USER",
        resource_id=usuario_id,
        description=f"Usuário {usuario_id} atualizado",
        request=request
    )
    return resultado