from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import obter_administrador_atual
from app.schemas.audit_schema import AuditLogResponse
from app.services.audit_service import audit_service

router = APIRouter(dependencies=[Depends(obter_administrador_atual)])

@router.get("/audit-logs", response_model=list[AuditLogResponse])
def listar_logs_auditoria(limite: int = 100):
    try:
        return audit_service.listar_logs_auditoria(limite)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar logs de auditoria: {error}"
        ) from error
