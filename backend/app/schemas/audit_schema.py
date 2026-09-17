from pydantic import BaseModel
from typing import Any

class AuditLogResponse(BaseModel):
    id: int
    admin_id: int | None
    admin_nome: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    description: str | None
    ip_address: str | None
    user_agent: str | None
    request_id: str | None
    status: str
    metadata: dict[str, Any] | None
    created_at: str
