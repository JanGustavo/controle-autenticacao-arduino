"""
Responsável por processar fotos/imagens via OpenCV/Dlib, extrair o vetor facial 
de 128 dimensões e realizar cálculos de similaridade biométrica.
"""

import os
import cv2
import face_recognition
import numpy as np


class FaceService:
    @staticmethod
    def extract_face_vector(image_bytes: bytes) -> list[float] | None:
        """Recebe os bytes de uma imagem, detecta o rosto, aplica alinhamento

        e extrai um embedding facial de 128 dimensões.
        """
        print("[DEBUG - FaceService] Iniciando processamento de imagem...")
        if not image_bytes:
            print("[DEBUG - FaceService] Bytes de imagem vazios.")
            return None

        nparr = np.frombuffer(image_bytes, np.uint8)
        if nparr.size == 0:
            print("[DEBUG - FaceService] Buffer da imagem inválido.")
            return None

        try:
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"[DEBUG - FaceService] Erro ao decodificar imagem: {e}")
            return None

        if img is None:
            print("[DEBUG - FaceService] Decodificação retornou imagem nula.")
            return None

        # Conversão para RGB
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w = rgb_img.shape[:2]
        print(f"[DEBUG - FaceService] Resolução original: {w}x{h}")

        # 1. Downscaling otimizado para acelerar HOG em imagens grandes (> 640x480)
        scale = 0.5 if (w > 640 or h > 480) else 1.0
        if scale != 1.0:
            small_img = cv2.resize(rgb_img, (0, 0), fx=scale, fy=scale)
            print(f"[DEBUG - FaceService] Redimensionado com escala {scale} para aceleração HOG.")
        else:
            small_img = rgb_img

        face_locations = face_recognition.face_locations(small_img, model="hog")
        print(f"[DEBUG - FaceService] Detecção HOG inicial encontrou {len(face_locations)} rosto(s).")

        # Se encontrou no frame reduzido, mapeia as coordenadas para o tamanho original
        if face_locations and scale != 1.0:
            inv = 1.0 / scale
            face_locations = [
                (int(top * inv), int(right * inv), int(bottom * inv), int(left * inv))
                for (top, right, bottom, left) in face_locations
            ]

        # Se não encontrou no frame reduzido, tenta no tamanho original
        if not face_locations and scale != 1.0:
            print("[DEBUG - FaceService] Tentando detecção HOG no tamanho original...")
            face_locations = face_recognition.face_locations(rgb_img, model="hog")

        # Fallback CLAHE para ambientes com iluminação ruim
        if not face_locations:
            print("[DEBUG - FaceService] Nenhum rosto detectado. Aplicando equalização CLAHE (Ambiente escuro/sombra)...")
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            img_equalized = cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
            face_locations = face_recognition.face_locations(img_equalized, model="hog")
            print(f"[DEBUG - FaceService] Detecção com CLAHE encontrou {len(face_locations)} rosto(s).")
            if not face_locations:
                print("[DEBUG - FaceService] Falha na detecção: Nenhum rosto encontrado.")
                return None
            rgb_img = img_equalized

        # 2. Extração do vetor facial com num_jitters=1 para alta velocidade (< 400ms)
        encodings = face_recognition.face_encodings(
            rgb_img,
            known_face_locations=face_locations,
            num_jitters=1
        )

        if not encodings:
            print("[DEBUG - FaceService] Falha ao extrair encodings do rosto.")
            return None

        print("[DEBUG - FaceService] Vetor facial de 128 dimensões extraído com sucesso.")
        return encodings[0].tolist()

    @staticmethod
    def distance_to_similarity(distance: float) -> tuple[float, bool]:
        """Converte a distância euclidiana dlib em percentual humano e flag de match com base no .env."""
        min_similarity = float(os.getenv("P_MINIMA_BIOMETRIA", 80))
        
        if distance <= 0.60:
            similarity_percentage = 100.0 - (distance / 0.60) * (100.0 - min_similarity)
        else:
            similarity_percentage = max(0.0, min_similarity - ((distance - 0.60) / 0.40) * min_similarity)

        similarity_percentage = float(round(similarity_percentage, 2))
        is_match = similarity_percentage >= min_similarity

        print(f"[DEBUG - FaceService] Distância: {distance:.4f} -> Similaridade: {similarity_percentage}% | Match: {is_match} (Corte: {min_similarity}%)")
        return similarity_percentage, is_match

    @staticmethod
    def calculate_similarity(vector1: list[float], vector2: list[float]) -> tuple[float, bool]:
        """Calcula a similaridade entre dois vetores de 128 dimensões."""
        v1 = np.array(vector1)
        v2 = np.array(vector2)

        if v1.shape != (128,) or v2.shape != (128,):
            print("[DEBUG - FaceService] Vetores faciais possuem dimensão inválida (diferente de 128).")
            return 0.0, False

        distance = float(face_recognition.face_distance([v1], v2)[0])
        return FaceService.distance_to_similarity(distance)

    @staticmethod
    def calculate_batch_similarities(known_vectors: list[list[float]], target_vector: list[float]) -> list[tuple[float, bool]]:
        """Calcula similaridades em lote via vetorização NumPy ultrarrápida."""
        if not known_vectors:
            return []
        arr_known = np.array(known_vectors)
        arr_target = np.array(target_vector)
        distances = face_recognition.face_distance(arr_known, arr_target)
        return [FaceService.distance_to_similarity(float(d)) for d in distances]