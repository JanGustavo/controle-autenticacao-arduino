from pydantic import BaseModel
from typing import Optional


class FaceVectorResponse(BaseModel):
    vector: Optional[list[float]] = None
    success: bool
    message: str


class SimilarityResult(BaseModel):
    similarity: float
    threshold: float
    is_match: bool