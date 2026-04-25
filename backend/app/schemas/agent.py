from pydantic import BaseModel
from typing import List


class AnalyzeRequest(BaseModel):
    prompt: str


class MarketAnalystResponse(BaseModel):
    insights: List[str]
    confidence: int
    key_risk: str
