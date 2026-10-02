import os
import time
import cv2
import numpy as np
import pytest
from app.services.face_service import FaceService


def test_extract_face_vector_invalid_data():
    """Garante que bytes inválidos ou vazios retornam None rapidamente."""
    assert FaceService.extract_face_vector(b"") is None
    assert FaceService.extract_face_vector(b"not-an-image") is None


def test_extract_face_vector_no_face_fast():
    """Garante que imagem sem rosto responde rapidamente (< 2s)."""
    img = np.zeros((720, 1280, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)

    t0 = time.time()
    vector = FaceService.extract_face_vector(buf.tobytes())
    t1 = time.time()

    assert vector is None
    assert (t1 - t0) < 2.0


def test_calculate_similarity_rnf02_threshold():
    """Valida o cálculo do percentual de similaridade e corte conforme o threshold configurado."""
    v1 = [0.1] * 128
    v2 = [0.1] * 128
    v_oposto = [-0.1] * 128

    # 1. Vetores idênticos -> similaridade 1.0 (aprovado)
    res_identico = FaceService.calculate_similarity(v1, v2)
    assert res_identico.similarity == 1.0
    assert res_identico.is_match is True

    # 2. Vetores opostos -> similaridade -1.0 (reprovado)
    res_oposto = FaceService.calculate_similarity(v1, v_oposto)
    assert res_oposto.similarity == -1.0
    assert res_oposto.is_match is False


def test_calculate_batch_similarities():
    """Garante que a comparação em lote calcula os resultados com precisão."""
    target = [0.1] * 128
    v_identico = [0.1] * 128
    v_diferente = [-0.1] * 128

    resultados = FaceService.calculate_batch_similarities([v_identico, v_diferente], target)
    assert len(resultados) == 2

    assert resultados[0].similarity == 1.0
    assert resultados[0].is_match is True

    assert resultados[1].similarity == -1.0
    assert resultados[1].is_match is False

def test_model_initialization_is_shared_and_warmed(monkeypatch):
    """Acessos simultâneos não veem um modelo parcialmente preparado."""
    from concurrent.futures import ThreadPoolExecutor
    from unittest.mock import Mock
    model = Mock()
    factory = Mock(return_value=model)
    monkeypatch.setattr(FaceService, "_app", None)
    monkeypatch.setattr("app.services.face_service.FaceAnalysis", factory)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: FaceService._get_model(), range(4)))
    assert all(result is model for result in results)
    factory.assert_called_once()
    model.prepare.assert_called_once()
    model.get.assert_called_once()
    assert model.get.call_args.args[0].shape == (480, 480, 3)


def test_failed_prepare_does_not_publish_model(monkeypatch):
    from unittest.mock import Mock
    model = Mock()
    model.prepare.side_effect = RuntimeError("modelo indisponível")
    monkeypatch.setattr(FaceService, "_app", None)
    monkeypatch.setattr("app.services.face_service.FaceAnalysis", Mock(return_value=model))
    with pytest.raises(RuntimeError):
        FaceService._get_model()
    assert FaceService._app is None
