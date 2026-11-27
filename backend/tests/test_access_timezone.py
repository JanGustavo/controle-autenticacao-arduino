from datetime import datetime, time, timezone
from unittest.mock import patch

import pytest

from app.utils.access_time import ACCESS_ZONE, agora_acesso, iso_acesso
from app.services.acesso_service import AcessoService


@pytest.mark.parametrize('os_timezone', ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo'])
def test_permission_until_18_accepts_17_brasilia_in_any_os_timezone(monkeypatch, os_timezone):
    monkeypatch.setenv('TZ', os_timezone)
    # 20:10 UTC is 17:10 in Brasília, irrespective of the host timezone.
    instant = datetime(2026, 10, 2, 20, 10, tzinfo=timezone.utc)
    with patch('app.utils.access_time.datetime') as clock:
        clock.now.side_effect = lambda zone: instant.astimezone(zone)
        now = AcessoService._agora()
    assert now == datetime(2026, 10, 2, 17, 10)
    allowed, reason = AcessoService._permissao_valida(time(8), time(18), [6], now)
    assert allowed and reason is None
    assert iso_acesso(now) == '2026-10-02T17:10:00-03:00'


def test_permission_after_end_is_denied_without_extending_schedule():
    allowed, reason = AcessoService._permissao_valida(time(8), time(18), [6], datetime(2026, 10, 2, 18, 1))
    assert not allowed
    assert 'fora do horário' in reason


def test_local_day_is_used_near_utc_midnight():
    instant = datetime(2026, 10, 3, 1, 30, tzinfo=timezone.utc)
    with patch('app.utils.access_time.datetime') as clock:
        clock.now.side_effect = lambda zone: instant.astimezone(zone)
        now = agora_acesso()
    assert now == datetime(2026, 10, 2, 22, 30)
    assert AcessoService._permissao_valida(time(22), time(6), [6], now)[0]
    assert not AcessoService._permissao_valida(time(22), time(6), [7], now)[0]


def test_iso_access_converts_aware_utc_instant():
    assert iso_acesso(datetime(2026, 10, 2, 20, 10, tzinfo=timezone.utc)) == '2026-10-02T17:10:00-03:00'



def test_overnight_window_uses_start_day_after_midnight():
    # Sexta-feira (6), 22:00 até sábado, 06:00.
    assert AcessoService._permissao_valida(
        time(22), time(6), [6], datetime(2026, 10, 3, 5, 30)
    )[0]
    assert not AcessoService._permissao_valida(
        time(22), time(6), [7], datetime(2026, 10, 3, 5, 30)
    )[0]


def test_overnight_window_does_not_extend_into_next_day_start():
    # A janela de sexta termina sábado às 06:00.
    assert not AcessoService._permissao_valida(
        time(22), time(6), [6], datetime(2026, 10, 3, 6, 1)
    )[0]


def test_0800_to_0759_covers_the_full_start_day_window():
    # Sexta 08:00 até sábado 07:59, inclusive o último segundo do minuto.
    assert AcessoService._permissao_valida(
        time(8), time(7, 59), [6], datetime(2026, 10, 2, 8, 0)
    )[0]
    assert AcessoService._permissao_valida(
        time(8), time(7, 59), [6], datetime(2026, 10, 3, 7, 59, 59)
    )[0]
    assert not AcessoService._permissao_valida(
        time(8), time(7, 59), [6], datetime(2026, 10, 3, 8, 0)
    )[0]


def test_overnight_window_before_start_time_is_denied():
    # Sexta-feira 07:59 ainda não pertence à janela que começa às 08:00.
    assert not AcessoService._permissao_valida(
        time(8), time(7, 59), [6], datetime(2026, 10, 2, 7, 59)
    )[0]
