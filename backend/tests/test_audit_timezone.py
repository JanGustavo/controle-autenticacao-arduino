from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.services.audit_service import AuditService


@pytest.mark.parametrize("offset", [0, -3])
def test_audit_response_keeps_timezone_of_database_result(offset):
    instant = datetime(2026, 10, 2, 19 if offset == 0 else 16, 1, 11,
                       tzinfo=timezone(timedelta(hours=offset)))
    row = (460, 1, "Administrador", "LOGIN_SUCCESS", "AUTH", None,
           "Login bem-sucedido", "172.18.0.4", None, "request", "SUCCESS", None, instant)
    connection = MagicMock()
    cursor = connection.__enter__.return_value.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = [row]

    with patch("app.services.audit_service.get_connection", return_value=connection):
        result = AuditService.listar_logs_auditoria()

    parsed = datetime.fromisoformat(result[0]["created_at"])
    assert parsed.tzinfo is not None
    assert parsed.astimezone(timezone.utc) == datetime(2026, 10, 2, 19, 1, 11, tzinfo=timezone.utc)
    sql = cursor.execute.call_args.args[0]
    assert "AT TIME ZONE al.created_at_timezone" in sql
