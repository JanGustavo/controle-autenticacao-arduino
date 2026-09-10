from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import adm_page, database_health, health
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

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(database_health.router, prefix="/api", tags=["health"])
app.include_router(adm_page.router, prefix="/api", tags=["adm"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
