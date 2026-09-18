import pytest
import numpy as np
import cv2
import time
from app.services.face_service import FaceService

def test_extract_face_vector_invalid_data():
    """Garante que bytes inválidos ou vazios retornam None rapidamente."""
    assert FaceService.extract_face_vector(b"") is None
    assert FaceService.extract_face_vector(b"not-an-image") is None

def test_extract_face_vector_no_face_fast():
    """Garante que imagem sem rosto não trava a CPU e responde em tempo aceitável (< 2s)."""
    img = np.zeros((720, 1280, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    
    t0 = time.time()
    vector = FaceService.extract_face_vector(buf.tobytes())
    t1 = time.time()
    
    assert vector is None
    # Deve ser bem menor que os 40-60 segundos anteriores
    assert (t1 - t0) < 2.0

def test_calculate_similarity_rnf02_threshold():
    """
    RNF02: A similaridade mínima entre os vetores faciais para considerar a mesma
    pessoa deverá ser de pelo menos 70%, podendo ser ajustada.
    """
    # 1. Distância 0.0 -> idêntico (100%)
    sim, aprovado = FaceService.distance_to_similarity(0.0)
    assert sim == 100.0
    assert aprovado is True

    # 2. Ponto de corte dlib oficial 0.60 -> exatamente 70.0% (aprovado)
    sim, aprovado = FaceService.distance_to_similarity(0.60)
    assert sim == 70.0
    assert aprovado is True

    # 3. Distância maior que 0.60 -> reprovado (< 70%)
    sim, aprovado = FaceService.distance_to_similarity(0.65)
    assert sim < 70.0
    assert aprovado is False

def test_calculate_batch_similarities():
    """Garante que a comparação em lote é precisa e rápida."""
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
