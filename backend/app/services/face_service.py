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
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return None

        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        face_locations = face_recognition.face_locations(rgb_img)
        if not face_locations:
            return None

        encodings = face_recognition.face_encodings(rgb_img, known_face_locations=face_locations)
        if not encodings:
            return None

        return encodings[0].tolist()

    @staticmethod
    def calculate_similarity(vector1: list[float], vector2: list[float]) -> tuple[float, bool]:
        v1 = np.array(vector1)
        v2 = np.array(vector2)

        if v1.shape != (128,) or v2.shape != (128,):
            return 0.0, False

        distance = face_recognition.face_distance([v1], v2)[0]
        similarity_percentage = max(0.0, (1.0 - distance)) * 100
        is_match = similarity_percentage >= 85.0

        # Converte explicitamente para tipos nativos do Python (float e bool)
        return float(round(similarity_percentage, 2)), bool(is_match)