from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    """
    Confirma que o backend está de pé.
    Usado como primeiro teste manual (curl/navegador) e depois
    como base pros testes automatizados com pytest.
    """
    return {"status": "ok"}
