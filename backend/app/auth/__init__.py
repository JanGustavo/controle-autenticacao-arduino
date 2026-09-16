"""Autenticacao do painel administrativo."""

from app.auth.dependencies import obter_administrador_atual

__all__ = ["obter_administrador_atual"]