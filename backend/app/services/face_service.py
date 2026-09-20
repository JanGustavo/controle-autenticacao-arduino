"""
Serviço responsável por detecção facial, extração de embeddings
e comparação biométrica utilizando InsightFace.

O serviço atualmente suporta comparação 1:N para compatibilidade
com o fluxo atual do ArdLock. Futuramente, com a integração do
RFID/ESP32, o mesmo serviço poderá ser utilizado para comparação
1:1 entre o rosto capturado e o vetor associado diretamente ao
cartão identificado (RF04).

Regra de segurança (0/1/2+ rostos):
    0 rostos  -> rejeita (FACE_NOT_FOUND)
    1 rosto   -> segue, se o tamanho for suficiente
    2+ rostos -> rejeita (FACE_MULTIPLE) -- nunca escolhe "o maior"
"""

import os
from typing import Optional

import cv2
import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis

from app.schemas.face_schema import SimilarityResult, FaceVectorResponse


class FaceService:
    """
    Serviço central de reconhecimento facial.

    O modelo é inicializado uma única vez (padrão singleton de classe)
    para evitar o custo de recarregar os pesos a cada requisição --
    esse carregamento é justamente o que estava inflando a primeira
    medição do benchmark antigo.
    """

    _app: Optional[FaceAnalysis] = None

    # Proporção mínima (bbox_area / image_area) para considerar o rosto
    # grande o suficiente pra confiar no embedding. Ajustável por .env.
    _MIN_FACE_AREA_RATIO = float(os.getenv("FACE_MIN_AREA_RATIO", "0.03"))

    @classmethod
    def _get_model(cls) -> FaceAnalysis:
        """
        Inicializa o InsightFace uma única vez, com as SessionOptions
        do ONNX Runtime efetivamente aplicadas (o bug anterior criava
        o objeto SessionOptions e nunca o passava adiante).
        """

        if cls._app is None:
            intra = int(os.getenv("ORT_INTRA_OP_THREADS", "8"))
            inter = int(os.getenv("ORT_INTER_OP_THREADS", "1"))

            print(
                f"[FaceService] Inicializando InsightFace "
                f"(intra_op={intra}, inter_op={inter})..."
            )

            so = ort.SessionOptions()
            so.intra_op_num_threads = intra
            so.inter_op_num_threads = inter
            so.execution_mode = ort.ExecutionMode.ORT_PARALLEL
            so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            det_size = int(os.getenv("FACE_DET_SIZE", "640"))

            cls._app = FaceAnalysis(
                name=os.getenv("FACE_MODEL", "buffalo_l"),
                providers=["CPUExecutionProvider"],
                # Nome correto do kwarg repassado ao onnxruntime.InferenceSession.
                # Confirme com `htop` durante uma chamada real que os núcleos
                # sobem juntos -- isso é o que garante que pegou de verdade.
                sess_options=so,
            )

            cls._app.prepare(ctx_id=0, det_size=(det_size, det_size))

            print("[FaceService] InsightFace inicializado com sucesso.")

        return cls._app

    @staticmethod
    def _decode_image(image_bytes: bytes) -> Optional[np.ndarray]:
        """Converte bytes recebidos para uma imagem OpenCV."""

        if not image_bytes:
            print("[FaceService] Bytes da imagem vazios.")
            return None

        try:
            nparr = np.frombuffer(image_bytes, np.uint8)

            if nparr.size == 0:
                print("[FaceService] Buffer da imagem inválido.")
                return None

            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                print("[FaceService] Não foi possível decodificar a imagem.")
                return None

            return image

        except Exception as exc:
            print(f"[FaceService] Erro ao decodificar imagem: {exc}")
            return None

    @classmethod
    def detect_faces(cls, image: np.ndarray) -> list:
        """Detecta os rostos presentes na imagem. Retorna a lista de Face do InsightFace."""

        try:
            model = cls._get_model()
            faces = model.get(image)
            print(f"[FaceService] Detecção concluída: {len(faces)} rosto(s).")
            return faces

        except Exception as exc:
            print(f"[FaceService] Erro durante detecção facial: {exc}")
            return []

    @classmethod
    def _face_area_ratio(cls, face, image: np.ndarray) -> float:
        bbox = face.bbox
        width = max(0.0, bbox[2] - bbox[0])
        height = max(0.0, bbox[3] - bbox[1])
        face_area = width * height
        image_area = image.shape[0] * image.shape[1]
        if image_area == 0:
            return 0.0
        return face_area / image_area

    @classmethod
    def extract_face_vector_detailed(cls, image_bytes: bytes) -> FaceVectorResponse:
        """
        Versão detalhada da extração: além do vetor, informa o motivo
        exato da falha (para alimentar o RF09 -- registro do motivo da
        recusa no histórico de acesso).

        Regra de segurança: 0 rostos rejeita, 1 rosto segue (se grande
        o suficiente), 2+ rostos rejeita -- nunca escolhe "o maior".
        """

        print("[FaceService] Iniciando extração do vetor facial...")

        image = cls._decode_image(image_bytes)
        if image is None:
            return FaceVectorResponse(vector=None, success=False, message="FACE_DECODE_ERROR")

        height, width = image.shape[:2]
        print(f"[FaceService] Resolução da imagem: {width}x{height}")

        faces = cls.detect_faces(image)

        if len(faces) == 0:
            print("[FaceService] Nenhum rosto encontrado.")
            return FaceVectorResponse(vector=None, success=False, message="FACE_NOT_FOUND")

        if len(faces) > 1:
            print(f"[FaceService] {len(faces)} rostos detectados -- rejeitando por segurança.")
            return FaceVectorResponse(vector=None, success=False, message="FACE_MULTIPLE")

        face = faces[0]
        area_ratio = cls._face_area_ratio(face, image)

        if area_ratio < cls._MIN_FACE_AREA_RATIO:
            print(
                f"[FaceService] Rosto pequeno demais "
                f"({area_ratio:.4f} < {cls._MIN_FACE_AREA_RATIO})."
            )
            return FaceVectorResponse(vector=None, success=False, message="FACE_TOO_SMALL")

        embedding = face.embedding
        if embedding is None:
            print("[FaceService] Modelo não retornou embedding.")
            return FaceVectorResponse(vector=None, success=False, message="FACE_EMBEDDING_ERROR")

        vector = np.asarray(embedding, dtype=np.float32)
        print(f"[FaceService] Vetor facial extraído com {vector.shape[0]} dimensões.")

        return FaceVectorResponse(vector=vector.tolist(), success=True, message="OK")

    @classmethod
    def extract_face_vector(cls, image_bytes: bytes) -> Optional[list[float]]:
        """
        Wrapper retrocompatível: mantém a assinatura antiga (retorna só
        o vetor ou None) para não quebrar quem já chama este método.
        Prefira extract_face_vector_detailed() em código novo, para
        conseguir o motivo da recusa.
        """
        result = cls.extract_face_vector_detailed(image_bytes)
        return result.vector if result.success else None

    @staticmethod
    def _normalize_vector(vector: list[float]) -> Optional[np.ndarray]:
        """Converte o vetor para NumPy e normaliza sua magnitude (p/ similaridade de cosseno)."""

        try:
            array = np.asarray(vector, dtype=np.float32)
            if array.ndim != 1:
                return None
            norm = np.linalg.norm(array)
            if norm == 0:
                return None
            return array / norm
        except Exception:
            return None

    @classmethod
    def calculate_similarity(cls, vector1: list[float], vector2: list[float]) -> SimilarityResult:
        """Compara dois embeddings faciais. Representa a futura comparação 1:1 do ArdLock."""

        v1 = cls._normalize_vector(vector1)
        v2 = cls._normalize_vector(vector2)

        if v1 is None or v2 is None or v1.shape != v2.shape:
            if v1 is not None and v2 is not None:
                print("[FaceService] Vetores possuem dimensões incompatíveis.")
            return cls._build_similarity_result(0.0)

        similarity = float(np.dot(v1, v2))
        return cls._build_similarity_result(similarity)

    @classmethod
    def calculate_batch_similarities(
        cls, known_vectors: list[list[float]], target_vector: list[float]
    ) -> list[SimilarityResult]:
        """
        Compara um vetor facial com vários vetores conhecidos.
        Mantido temporariamente para o fluxo 1:N atual do ArdLock.
        """

        if not known_vectors:
            return []

        target = cls._normalize_vector(target_vector)
        if target is None:
            print("[FaceService] Vetor alvo inválido.")
            return [cls._build_similarity_result(0.0) for _ in known_vectors]

        results: list[SimilarityResult] = []
        for known_vector in known_vectors:
            known = cls._normalize_vector(known_vector)
            if known is None or known.shape != target.shape:
                results.append(cls._build_similarity_result(0.0))
                continue
            similarity = float(np.dot(known, target))
            results.append(cls._build_similarity_result(similarity))

        return results

    @staticmethod
    def _get_threshold() -> float:
        """Threshold configurável por .env (ainda em calibração -- ver seção 8 do RNF02)."""
        try:
            return float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.50"))
        except ValueError:
            return 0.50

    @classmethod
    def _build_similarity_result(cls, similarity: float) -> SimilarityResult:
        threshold = cls._get_threshold()
        is_match = similarity >= threshold
        similarity = round(float(similarity), 6)

        print(
            f"[FaceService] Similaridade: {similarity:.6f} | "
            f"Threshold: {threshold:.6f} | Match: {is_match}"
        )

        return SimilarityResult(similarity=similarity, threshold=threshold, is_match=is_match)