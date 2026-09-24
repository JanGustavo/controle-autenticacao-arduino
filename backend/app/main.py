import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ─────────────────────────────────────────────
# Routers da API
# ─────────────────────────────────────────────
from app.api import (
    administradores,
    autenticacao,
    audit_logs,
    dispositivos,
    historico_acesso,
    locais,
    permissoes,
    rfid,
    usuarios,
    websocket,
)

from app.api.biometria import router as biometria
from app.api.health import database_health, health
from app.auth import router as auth
from app.services.expiracao_service import loop_expiracao_periodica
# from app.api import rfid


# ─────────────────────────────────────────────
# Configuração da aplicação
# ─────────────────────────────────────────────

BASE_PREFIX = "/api/v1"

TAGS_METADATA = [
    {
        "name": "Auth portal",
        "description": (
            "Login, recuperação e redefinição de senha dos administradores. "
            "O login retorna o JWT usado nas rotas protegidas."
        ),
    },
    {
        "name": "Administradores",
        "description": "Gestão das contas administrativas e regras da conta principal.",
    },
    {
        "name": "Usuários",
        "description": "CRUD de pessoas autorizáveis, cartão RFID e estado do usuário.",
    },
    {
        "name": "Locais",
        "description": "Ambientes físicos protegidos pelo ArdLock.",
    },
    {
        "name": "Dispositivos",
        "description": (
            "Controladoras ESP32/leitores vinculados a um local. "
            "Um local pode possuir vários dispositivos."
        ),
    },
    {
        "name": "Permissões",
        "description": "Regras de acesso por usuário, local, dias da semana e janela horária.",
    },
    {
        "name": "Biometria",
        "description": (
            "Cadastro administrativo do embedding facial. "
            "A imagem original não é o dado persistido do usuário."
        ),
    },
    {
        "name": "RFID",
        "description": (
            "Fluxo físico de acesso: elegibilidade RFID, validação facial 1:1 "
            "e consulta da decisão pelo ESP32."
        ),
    },
    {
        "name": "Histórico de Acesso",
        "description": "Registro das tentativas físicas autorizadas, negadas e expiradas.",
    },
    {
        "name": "Logs de Auditoria",
        "description": "Trilha de ações administrativas, IP, recurso e data/hora.",
    },
    {
        "name": "WebSocket",
        "description": "Eventos em tempo real para painel e Totem.",
    },
    {
        "name": "Health Check",
        "description": "Disponibilidade básica da aplicação.",
    },
    {
        "name": "Database Health Check",
        "description": "Diagnóstico da conectividade com o PostgreSQL.",
    },
    {
        "name": "Autenticação-facial",
        "description": (
            "Rota legada de diagnóstico biométrico. Não participa do fluxo "
            "operacional de liberação de acesso."
        ),
    },
]

API_DESCRIPTION = """
# ArdLock API

API central do sistema de controle de acesso **RFID + biometria facial 1:1 + ESP32**.

## Fluxo operacional

1. **ESP32** envia RFID e `identificador_dispositivo`.
2. O backend valida dispositivo, local, usuário, permissão, dia e horário.
3. Se elegível, cria uma `tentativa_id` com status **PENDENTE**.
4. O **Totem** envia a captura facial autenticado por JWT.
5. O backend compara a face **somente com o titular identificado pelo RFID**.
6. As regras de acesso são revalidadas antes do fechamento.
7. O backend persiste a decisão e o ESP32 consulta **aguardar / liberar / negar**.

> O backend é a única fonte da decisão. O ESP32 não envia `aprovado=true`.

## Autenticação

Rotas administrativas usam **Bearer JWT**. Use **Authorize** no topo do Swagger
depois de obter o token em `POST /api/v1/auth/login`.

As rotas físicas do ESP32 estão preparadas para autenticação HMAC por dispositivo,
que permanece como hardening posterior.

## Debug rápido

- `GET /api/v1/health`: aplicação
- `GET /api/v1/health/db`: PostgreSQL
- `POST /api/v1/arduino/verificar-cartao`: inicia tentativa
- `POST /api/v1/arduino/verificar-face`: fecha biometria 1:1
- `GET /api/v1/arduino/resultado-acesso`: decisão para o ESP32

Documentação adicional: `docs/BACKEND.md` e `docs/API_DEBUG.md`.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Inicializa e encerra tarefas de infraestrutura da aplicação.
    """
    task_expiracao = asyncio.create_task(
        loop_expiracao_periodica(),
        name="expiracao-tentativas-acesso",
    )

    try:
        yield
    finally:
        task_expiracao.cancel()

        try:
            await task_expiracao
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="ArdLock API",
    summary="Controle de acesso físico com RFID, biometria facial 1:1 e ESP32",
    description=API_DESCRIPTION,
    version="0.3.0",
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={
        "displayRequestDuration": True,
        "filter": True,
        "persistAuthorization": True,
        "tryItOutEnabled": True,
        "docExpansion": "list",
        "defaultModelsExpandDepth": 1,
    },
)


# ─────────────────────────────────────────────
# Configuração de CORS
# ─────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:4200",
        "http://localhost:8000",
        "http://localhost:8001",
        "http://127.0.0.1",
        "http://127.0.0.1:4200",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8001",
    ],
    allow_origin_regex=r"http\://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────

app.include_router(
    health.router,
    prefix=BASE_PREFIX,
    tags=["Health Check"],
)

app.include_router(
    database_health.router,
    prefix=f"{BASE_PREFIX}/health",
    tags=["Database Health Check"],
)


# ─────────────────────────────────────────────
# Autenticação e controle de acesso
# ─────────────────────────────────────────────

app.include_router(
    auth.router,
    prefix=f"{BASE_PREFIX}/auth",
    tags=["Auth portal"],
)

app.include_router(
    autenticacao.router,
    prefix=BASE_PREFIX + "/autenticacao",
    tags=["Autenticação-facial"],
)

app.include_router(
    administradores.router,
    prefix=BASE_PREFIX,
    tags=["Administradores"],
)

app.include_router(
    permissoes.router,
    prefix=BASE_PREFIX,
    tags=["Permissões"],
)


# ─────────────────────────────────────────────
# Biometria facial
# ─────────────────────────────────────────────

app.include_router(
    biometria,
    prefix=BASE_PREFIX,
    tags=["Biometria"],
)


# ─────────────────────────────────────────────
# Usuários e locais
# ─────────────────────────────────────────────

app.include_router(
    usuarios.router,
    prefix=BASE_PREFIX,
    tags=["Usuários"],
)

app.include_router(
    locais.router,
    prefix=BASE_PREFIX,
    tags=["Locais"],
)

app.include_router(
    dispositivos.router,
    prefix=BASE_PREFIX,
    tags=["Dispositivos"],
)


# ─────────────────────────────────────────────
# Histórico e auditoria
# ─────────────────────────────────────────────

app.include_router(
    historico_acesso.router,
    prefix=BASE_PREFIX,
    tags=["Histórico de Acesso"],
)

app.include_router(
    audit_logs.router,
    prefix=f"{BASE_PREFIX}/adm",
    tags=["Logs de Auditoria"],
)


# ─────────────────────────────────────────────
# Comunicação em tempo real
# ─────────────────────────────────────────────

app.include_router(
    websocket.router,
    tags=["WebSocket"],
)


# ─────────────────────────────────────────────
# Comunicação com Arduino / ESP32
# ─────────────────────────────────────────────

app.include_router(
    rfid.router,
    prefix=f"{BASE_PREFIX}/arduino",
    tags=["RFID"],
)
