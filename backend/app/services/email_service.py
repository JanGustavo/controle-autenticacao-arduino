import os

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType


def _obter_config_mail() -> ConnectionConfig:
    """Monta a configuração do fastapi-mail a partir das variáveis de ambiente."""
    return ConnectionConfig(
        MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
        MAIL_FROM=os.getenv("MAIL_FROM", ""),
        MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
        MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
        MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "true").lower() == "true",
        MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "false").lower() == "true",
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )


async def enviar_email_reset(destinatario: str, reset_url: str) -> None:
    """Envia o e-mail de redefinição de senha para o administrador.

    Responsabilidade única: disparar o e-mail com o link de reset.
    A geração e validação do token são tratadas pelo serviço de autenticação.
    """
    mail = FastMail(_obter_config_mail())

    message = MessageSchema(
        subject="Redefinição de senha - ArdLock",
        recipients=[destinatario],
        body=f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">Redefinição de senha</h2>

                <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>ArdLock</strong>.</p>

                <p>
                    <a href="{reset_url}"
                       style="display: inline-block; padding: 12px 24px; background-color: #4f46e5;
                              color: #ffffff; text-decoration: none; border-radius: 6px;
                              font-weight: bold;">
                        Redefinir minha senha
                    </a>
                </p>

                <p style="color: #6b7280; font-size: 14px;">
                    Este link expira em <strong>30 minutos</strong>.<br>
                    Se você não solicitou a redefinição, pode ignorar este e-mail com segurança.
                </p>
            </div>
        """,
        subtype=MessageType.html,
    )

    await mail.send_message(message)
