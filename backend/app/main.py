from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import administradores
from app.api import autenticacao
from app.api import historico_acesso
from app.api import locais
from app.api import permissoes
from app.api import usuarios
from app.api import websocket
from app.api.health import database_health, health
from app.api.biometria import router as biometria
from app.api import audit_logs
from app.auth import router as auth
from app.api import rfid

app = FastAPI(
    title="Controle de Autenticação com Biometria Facial + RFID",
    description="Backend do projeto integrador de ADS — controle de acesso com arduino.",
    version="0.1.0",
)

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
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

base:str = "/api/v1"



app.include_router(health.router, prefix=base, tags=["health"])
app.include_router(database_health.router, prefix=base + "/health", tags=["database_health"])

app.include_router(permissoes.router, prefix=base, tags=["permissoes"])
app.include_router(historico_acesso.router, prefix=base, tags=["historico_acesso"])
app.include_router(locais.router, prefix=base, tags=["locais"])
app.include_router(usuarios.router, prefix=base, tags=["usuarios"])
app.include_router(audit_logs.router, prefix=base + "/adm", tags=["audit_logs"])
app.include_router(websocket.router, tags=["WebSocket"])
app.include_router(rfid.router, prefix=base + "/arduino", tags=["RFID"])