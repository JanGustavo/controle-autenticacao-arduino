from fastapi import APIRouter

router = APIRouter()

@router.get("/adm-page")
def admin_page():
    """
    Página de administração do sistema.
    """
    return {"message": "Bem-vindo à página de administração!"}
