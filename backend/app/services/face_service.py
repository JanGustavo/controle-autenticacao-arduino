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
        # Converte bytes da imagem para array NumPy/OpenCV
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return None

        # Converte BGR (OpenCV) para RGB (face_recognition)
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Detecta os rostos na imagem
        face_locations = face_recognition.face_locations(rgb_img)
        if not face_locations:
            return None  # Nenhum rosto encontrado

        # Extrai os encodings (pega o primeiro rosto detectado)
        encodings = face_recognition.face_encodings(rgb_img, known_face_locations=face_locations)
        if not encodings:
            return None

        # Retorna o vetor numérico como lista de floats
        return encodings[0].tolist()

    @staticmethod
    def calculate_similarity(vector1: list[float], vector2: list[float]) -> tuple[float, bool]:
        """
        Calcula a similaridade entre dois vetores e verifica se atinge o limiar.
        """
        v1 = np.array(vector1)
        v2 = np.array(vector2)

        # Distância Euclidiana entre os vetores (0.0 = idênticos)
        distance = face_recognition.face_distance([v1], v2)[0]

        # Conversão empírica da distância em porcentagem de similaridade
        similarity_percentage = max(0.0, (1.0 - distance)) * 100

        # Para aceitar, definimos a similaridade mínima em 85% (equivalente a distância <= 0.15)
        is_match = similarity_percentage >= 85.0

        return round(similarity_percentage, 2), is_match