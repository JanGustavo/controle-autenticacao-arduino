import json
import uuid
from typing import Any
from fastapi import Request

from app.database.connection import get_connection


class AuditService:
    @staticmethod
    def registrar(
        action: str,
        admin_id: int | None = None,
        resource_type: str | None = None,
        resource_id: str | int | None = None,
        description: str | None = None,
        request: Request | None = None,
        status: str = "SUCCESS",
        metadata: dict[str, Any] | None = None
    ) -> None:
        ip_address = request.client.host if request and request.client else None
        user_agent = request.headers.get("user-agent") if request else None
        
        # Se houver um X-Request-ID ou similar, poderíamos tentar pegar daqui
        request_id = str(uuid.uuid4())
        
        metadata_json = json.dumps(metadata) if metadata else None
        
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO audit_logs 
                        (admin_id, action, resource_type, resource_id, description, ip_address, user_agent, request_id, status, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            admin_id,
                            action,
                            resource_type,
                            str(resource_id) if resource_id is not None else None,
                            description,
                            ip_address,
                            user_agent,
                            request_id,
                            status,
                            metadata_json
                        )
                    )
        except Exception as e:
            # Não devemos falhar a requisição principal se o log falhar
            print(f"[AUDIT ERROR] Falha ao gravar log de auditoria: {e}")


    @staticmethod
    def listar_logs_auditoria(limite: int = 100):
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 
                        al.id, al.admin_id, a.nome as admin_nome, al.action, 
                        al.resource_type, al.resource_id, al.description, 
                        al.ip_address, al.user_agent, al.request_id, al.status, 
                        al.metadata, al.created_at
                    FROM audit_logs al
                    LEFT JOIN administrador a ON al.admin_id = a.admin_id
                    ORDER BY al.created_at DESC
                    LIMIT %s
                    """,
                    (limite,)
                )
                registros = cursor.fetchall()
                
                resultado = []
                for r in registros:
                    resultado.append({
                        "id": r[0],
                        "admin_id": r[1],
                        "admin_nome": r[2],
                        "action": r[3],
                        "resource_type": r[4],
                        "resource_id": r[5],
                        "description": r[6],
                        "ip_address": r[7],
                        "user_agent": r[8],
                        "request_id": r[9],
                        "status": r[10],
                        "metadata": r[11] if r[11] else None,
                        "created_at": r[12].isoformat() if r[12] else "",
                    })
                return resultado

audit_service = AuditService()
