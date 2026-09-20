from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ─────────────────────────────────────────────
# Routers da API
# ─────────────────────────────────────────────
from app.api import (
    administradores,
    autenticacao,
    audit_logs,
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


# ─────────────────────────────────────────────
# Configuração da aplicação
# ─────────────────────────────────────────────

BASE_PREFIX = "/api/v1"

app = FastAPI(
    title="Controle de Autenticação com Biometria Facial + RFID",
    description=(
        "Backend do projeto integrador de ADS — "
        "controle de acesso com arduino."
    ),
    version="0.1.0",
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
    prefix=BASE_PREFIX,
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