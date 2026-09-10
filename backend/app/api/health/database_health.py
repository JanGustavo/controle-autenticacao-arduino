from fastapi import APIRouter, HTTPException, status

from app.database.connection import get_connection

router = APIRouter()


@router.get("/db")
def database_health():
    try:
        with get_connection() as connection:
            connection.execute("SELECT 1")
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Banco de dados indisponível.",
        ) from error

    return {"status": "ok", "database": "ok"}