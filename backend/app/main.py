from app.api import adm_page
from app.api import usuarios
from app.api import permissoes
from app.api import historico_acesso
from app.api import locais
from app.api.health import health
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import database_health
from app.auth import router as auth

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
        "http://127.0.0.1:4200",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1/health", tags=["health"]) #http://127.0.0.1:8001/api/v1/health
app.include_router(database_health.router, prefix="/api/v1/health/db", tags=["database_health"]) #http://127.0.0.1:8001/api/v1/health/db
app.include_router(adm_page.router, prefix="/api/v1/adm", tags=["adm"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(usuarios.router, prefix="/api/v1", tags=["usuarios"])
app.include_router(permissoes.router, prefix="/api/v1", tags=["permissoes"])
app.include_router(historico_acesso.router, prefix="/api/v1", tags=["historico_acesso"])
app.include_router(locais.router, prefix="/api/v1", tags=["locais"])