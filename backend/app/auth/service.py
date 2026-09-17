import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status, Request
from psycopg import OperationalError

from app.services.audit_service import audit_service

from app.auth.schemas import EsqueciSenhaRequest, LoginRequest, LoginResponse, RedefinirSenhaRequest
from app.auth.security import (
    DUMMY_BCRYPT_HASH,
    criar_token_jwt,
    gerar_hash_senha,
    obter_expiracao_segundos,
    verificar_senha,
)
from app.database.connection import get_connection
from app.services.email_service import enviar_email_reset

_EXPIRACAO_RESET_MINUTOS = 30


def _hash_token(token: str) -> str:
    """Gera SHA-256 do token para armazenamento seguro no banco.

    O token original trafega apenas no e-mail; o banco nunca armazena o valor bruto.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def autenticar(credenciais: LoginRequest, request: Request | None = None) -> LoginResponse:
    termo_busca = credenciais.usuario.strip()

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT admin_id, nome, email, senha_hash, ativo, foto_url
                    FROM administrador
                    WHERE LOWER(email) = LOWER(%s)
                       OR (LOWER(email) = LOWER(%s || '@ardlock.local'))
                    """,
                    (termo_busca, termo_busca),
                )
                administrador = cursor.fetchone()
    except OperationalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível. Verifique o PostgreSQL local.",
        ) from error

    # Atenua timing attacks se o usuário não for encontrado
    if not administrador:
        verificar_senha(credenciais.senha, DUMMY_BCRYPT_HASH)
        audit_service.registrar(
            action="LOGIN_FAILED",
            admin_id=None,
            resource_type="AUTH",
            resource_id=None,
            description=f"Tentativa de login falhou (usuário não encontrado): {termo_busca}",
            request=request,
            status="FAILURE"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    admin_id, nome, email, senha_hash, ativo, foto_url = administrador
    senha_valida = verificar_senha(credenciais.senha, senha_hash)

    # Resposta genérica para não revelar se o usuário existe, está desativado ou errou a senha
    if not ativo or not senha_valida:
        audit_service.registrar(
            action="LOGIN_FAILED",
            admin_id=admin_id,
            resource_type="AUTH",
            resource_id=None,
            description=f"Tentativa de login falhou (inativo ou senha inválida)",
            request=request,
            status="FAILURE"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )

    audit_service.registrar(
        action="LOGIN_SUCCESS",
        admin_id=admin_id,
        resource_type="AUTH",
        resource_id=None,
        description="Login bem-sucedido",
        request=request
    )

    token = criar_token_jwt(sub=str(admin_id), email=email, extra_claims={"nome": nome, "foto_url": foto_url})
    expires_in = obter_expiracao_segundos()

    return LoginResponse(
        sucesso=True,
        token=token,
        usuario=email,
        token_type="bearer",
        expires_in=expires_in,
    )


async def solicitar_reset_senha(dados: EsqueciSenhaRequest, request: Request | None = None) -> dict[str, str]:
    """Gera token de recuperação e envia e-mail se o endereço estiver cadastrado.

    A resposta é sempre a mesma — independentemente de o e-mail existir ou não —
    para não revelar quais contas estão cadastradas no sistema.
    """
    resposta_generica = {
        "mensagem": "Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição."
    }

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT admin_id, email FROM administrador WHERE LOWER(email) = LOWER(%s) AND ativo = TRUE",
                    (dados.email.strip(),),
                )
                administrador = cursor.fetchone()
    except OperationalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível.",
        ) from error

    if not administrador:
        audit_service.registrar(
            action="PASSWORD_RESET_REQUESTED",
            admin_id=None,
            resource_type="AUTH",
            resource_id=None,
            description=f"Solicitação de reset de senha para e-mail não encontrado ou inativo: {dados.email.strip()}",
            request=request,
            status="FAILURE"
        )
        return resposta_generica

    admin_id, email = administrador

    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    # Usa datetime naive (UTC) para inserção em timestamp without timezone
    expira_em = (datetime.now(timezone.utc) + timedelta(minutes=_EXPIRACAO_RESET_MINUTOS)).replace(tzinfo=None)

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                # Invalida tokens anteriores pendentes do mesmo administrador
                cursor.execute(
                    "UPDATE password_reset_token SET usado = TRUE WHERE admin_id = %s AND usado = FALSE",
                    (admin_id,),
                )
                cursor.execute(
                    """
                    INSERT INTO password_reset_token (admin_id, token_hash, expira_em)
                    VALUES (%s, %s, %s)
                    """,
                    (admin_id, token_hash, expira_em),
                )
    except OperationalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível.",
        ) from error

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:4200")
    reset_url = f"{frontend_url}/reset-password?token={token}"

    try:
        await enviar_email_reset(email, reset_url)
        audit_service.registrar(
            action="PASSWORD_RESET_REQUESTED",
            admin_id=admin_id,
            resource_type="AUTH",
            resource_id=None,
            description="E-mail de redefinição de senha enviado",
            request=request
        )
    except Exception as e:
        print(f"Erro ao enviar email: {e}")
        audit_service.registrar(
            action="PASSWORD_RESET_REQUESTED",
            admin_id=admin_id,
            resource_type="AUTH",
            resource_id=None,
            description=f"Falha ao enviar e-mail de redefinição: {e}",
            request=request,
            status="FAILURE"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível enviar o e-mail de recuperação no momento. Tente novamente mais tarde."
        )

    return resposta_generica


def redefinir_senha(dados: RedefinirSenhaRequest, request: Request | None = None) -> dict[str, str]:
    """Valida o token de recuperação e atualiza a senha do administrador."""
    token_hash = _hash_token(dados.token.strip())

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, admin_id, expira_em, usado
                    FROM password_reset_token
                    WHERE token_hash = %s
                    """,
                    (token_hash,),
                )
                registro = cursor.fetchone()

                if not registro:
                    audit_service.registrar(
                        action="PASSWORD_RESET_COMPLETED",
                        admin_id=None,
                        resource_type="AUTH",
                        resource_id=None,
                        description="Tentativa de redefinição com token inválido/inexistente",
                        request=request,
                        status="FAILURE"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Token inválido ou expirado.",
                    )

                token_id, admin_id, expira_em, usado = registro

                agora = datetime.now(timezone.utc)
                if isinstance(expira_em, datetime) and expira_em.tzinfo is None:
                    expira_em = expira_em.replace(tzinfo=timezone.utc)

                if usado or agora > expira_em:
                    audit_service.registrar(
                        action="PASSWORD_RESET_COMPLETED",
                        admin_id=admin_id,
                        resource_type="AUTH",
                        resource_id=None,
                        description="Tentativa de redefinição com token já usado ou expirado",
                        request=request,
                        status="FAILURE"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Token inválido ou expirado.",
                    )

                nova_senha_hash = gerar_hash_senha(dados.nova_senha)

                cursor.execute(
                    "UPDATE administrador SET senha_hash = %s WHERE admin_id = %s",
                    (nova_senha_hash, admin_id),
                )
                cursor.execute(
                    "UPDATE password_reset_token SET usado = TRUE WHERE id = %s",
                    (token_id,),
                )
                
                audit_service.registrar(
                    action="PASSWORD_RESET_COMPLETED",
                    admin_id=admin_id,
                    resource_type="AUTH",
                    resource_id=None,
                    description="Senha redefinida com sucesso",
                    request=request
                )
    except OperationalError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível.",
        ) from error

    return {"mensagem": "Senha redefinida com sucesso."}