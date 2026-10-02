"""Business wall clock for the fixed access-permission timezone."""
from datetime import datetime
from zoneinfo import ZoneInfo

ACCESS_TIMEZONE = "America/Sao_Paulo"
ACCESS_ZONE = ZoneInfo(ACCESS_TIMEZONE)


def agora_acesso() -> datetime:
    # The access tables use TIMESTAMP without timezone. Always use the same
    # business wall clock, independently of the operating system/container TZ.
    return datetime.now(ACCESS_ZONE).replace(tzinfo=None)


def iso_acesso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=ACCESS_ZONE)
    return value.astimezone(ACCESS_ZONE).isoformat()
