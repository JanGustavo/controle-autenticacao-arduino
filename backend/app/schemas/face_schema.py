from pydantic import BaseModel
from typing import Optional


class FaceVectorResponse(BaseModel):
    vector: Optional[list[float]] = None
    success: bool
    message: str


class SimilarityResult(BaseModel):
    distance: float
    similarity_percentage: float
    is_match: bool
    min_similarity_applied: float