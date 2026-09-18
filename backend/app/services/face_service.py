'''Responsável por pegar os bytes da foto, aplicar OpenCV/Dlib/DeepFace, extrair os 128 vetores numéricos e efetuar o cálculo de distância/similaridade.'''

import face_recognition
import numpy as np
import cv2

class FaceService:
    @staticmethod
    def extract_face_vector(image_bytes: bytes) -> list[float] | None:
        """
        Recebe os bytes da imagem (envio do front), detecta o rosto,
        realiza o alinhamento e retorna um vetor de 128 dimensões.
        """
        if not image_bytes:
            return None

        nparr = np.frombuffer(image_bytes, np.uint8)
        if nparr.size == 0:
            return None

        try:
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception:
            return None

        if img is None:
            return None

        # Conversão direta para RGB para detecção rápida
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        h, w = rgb_img.shape[:2]

        # 1. Detecção acelerada com modelo HOG em resolução otimizada (downscaling para câmeras HD)
        # Reduz a resolução para detecção se a imagem for grande (> 640 de largura ou > 480 de altura)
        scale = 0.5 if (w > 640 or h > 480) else 1.0
        if scale != 1.0:
            small_img = cv2.resize(rgb_img, (0, 0), fx=scale, fy=scale)
        else:
            small_img = rgb_img

        face_locations = face_recognition.face_locations(small_img, model="hog")

        # Se encontrou no frame reduzido, mapeia as coordenadas de volta para a escala original
        if face_locations and scale != 1.0:
            inv = 1.0 / scale
            face_locations = [
                (int(top * inv), int(right * inv), int(bottom * inv), int(left * inv))
                for (top, right, bottom, left) in face_locations
            ]

        # Se não encontrou no frame reduzido, tenta no tamanho original
        if not face_locations and scale != 1.0:
            face_locations = face_recognition.face_locations(rgb_img, model="hog")

        # Fallback rápido com equalização CLAHE caso ainda não tenha detectado (ambientes escuros)
        if not face_locations:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            img_equalized = cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
            face_locations = face_recognition.face_locations(img_equalized, model="hog")
            if not face_locations:
                return None
            rgb_img = img_equalized

        # 2. Extração do embedding facial com num_jitters=1 para resposta em tempo real (< 400ms)
        # Mantém 99.38% de precisão padrão do modelo dlib ResNet sem a latência proibitiva de múltiplos jitters
        encodings = face_recognition.face_encodings(
            rgb_img,
            known_face_locations=face_locations,
            num_jitters=1
        )
        if not encodings:
            return None

        return encodings[0].tolist()

    @staticmethod
    def distance_to_similarity(distance: float) -> tuple[float, bool]:
        """Converte a distância euclidiana dlib em percentual humano e flag de match (ponto de corte 70%)."""
        if distance <= 0.60:
            # 0.00 -> 100.0%, 0.60 -> 70.0%
            similarity_percentage = 100.0 - (distance / 0.60) * 30.0
        else:
            # 0.60 -> 70.0%, 1.00 -> 0.0%
            similarity_percentage = max(0.0, 70.0 - ((distance - 0.60) / 0.40) * 70.0)

        is_match = distance <= 0.60
        return float(round(similarity_percentage, 2)), bool(is_match)

    @staticmethod
    def calculate_similarity(vector1: list[float], vector2: list[float]) -> tuple[float, bool]:
        v1 = np.array(vector1)
        v2 = np.array(vector2)

        if v1.shape != (128,) or v2.shape != (128,):
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