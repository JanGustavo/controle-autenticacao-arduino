import asyncio
from unittest.mock import Mock

from app.main import app, lifespan


def test_startup_warms_model_before_serving(monkeypatch):
    warmup = Mock()
    open_pool = Mock()
    close_pool = Mock()
    monkeypatch.setattr('app.main.FaceService._get_model', warmup)
    monkeypatch.setattr('app.main.open_pool', open_pool)
    monkeypatch.setattr('app.main.close_pool', close_pool)

    async def expiration():
        await asyncio.Event().wait()

    monkeypatch.setattr('app.main.loop_expiracao_periodica', expiration)

    async def run():
        async with lifespan(app):
            warmup.assert_called_once()
            open_pool.assert_called_once()
            close_pool.assert_not_called()

    asyncio.run(run())
    close_pool.assert_called_once()


def test_failed_warmup_blocks_startup(monkeypatch):
    import pytest
    open_pool = Mock()
    monkeypatch.setattr('app.main.open_pool', open_pool)
    monkeypatch.setattr('app.main.FaceService._get_model',
                        Mock(side_effect=RuntimeError('model unavailable')))

    async def run():
        async with lifespan(app):
            pytest.fail('Must not serve requests with unavailable model')

    with pytest.raises(RuntimeError, match='model unavailable'):
        asyncio.run(run())
    open_pool.assert_not_called()
