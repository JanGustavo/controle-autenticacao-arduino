import asyncio
from unittest.mock import Mock

from app.main import app, lifespan


def test_startup_warms_model_before_serving(monkeypatch):
    warmup = Mock()
    monkeypatch.setattr('app.main.FaceService._get_model', warmup)

    async def expiration():
        await asyncio.Event().wait()

    monkeypatch.setattr('app.main.loop_expiracao_periodica', expiration)

    async def run():
        async with lifespan(app):
            warmup.assert_called_once()

    asyncio.run(run())


def test_failed_warmup_blocks_startup(monkeypatch):
    import pytest
    monkeypatch.setattr('app.main.FaceService._get_model',
                        Mock(side_effect=RuntimeError('model unavailable')))

    async def run():
        async with lifespan(app):
            pytest.fail('Must not serve requests with unavailable model')

    with pytest.raises(RuntimeError, match='model unavailable'):
        asyncio.run(run())
