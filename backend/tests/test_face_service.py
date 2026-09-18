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
    """Valida o cálculo do percentual de similaridade e corte dinâmico conforme a variável de ambiente P_MINIMA_BIOMETRIA."""
    min_sim_esperada = float(os.getenv("P_MINIMA_BIOMETRIA", 80))

    # 1. Distância 0.0 -> idêntico (100.0%)
    sim, aprovado = FaceService.distance_to_similarity(0.0)
    assert sim == 100.0
    assert aprovado is True

    # 2. Ponto de corte dlib oficial (0.60) -> deve atingir exatamente min_similarity% (aprovado)
    sim, aprovado = FaceService.distance_to_similarity(0.60)
    assert sim == min_sim_esperada
    assert aprovado is True

    # 3. Distância maior que 0.60 -> reprovado (< min_similarity%)
    sim, aprovado = FaceService.distance_to_similarity(0.65)
    assert sim < min_sim_esperada
    assert aprovado is False


def test_calculate_batch_similarities():
    """Garante que a comparação em lote calcula os resultados com precisão."""
    target = [0.1] * 128
    v_identico = [0.1] * 128
    v_diferente = [-0.1] * 128

    resultados = FaceService.calculate_batch_similarities([v_identico, v_diferente], target)
    assert len(resultados) == 2

    sim_id, aprov_id = resultados[0]
    assert sim_id == 100.0
    assert aprov_id is True

    sim_dif, aprov_dif = resultados[1]
    assert aprov_dif is False