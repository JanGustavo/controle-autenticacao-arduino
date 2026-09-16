from fastapi import APIRouter, Depends

from app.auth.dependencies import obter_administrador_atual

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])


@router.get("/adm-page")
def admin_page():
    """Página de administração do sistema."""
    return {"message": "Bem-vindo à página de administração!"}

