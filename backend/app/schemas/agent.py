from pydantic import BaseModel
from typing import List


class AnalyzeRequest(BaseModel):
    prompt: str


class AgentResponse(BaseModel):
    insights: List[str]
    confidence: int
    key_risk: str


MarketAnalystResponse = AgentResponse
ProblemValidatorResponse = AgentResponse
RiskAnalystResponse = AgentResponse
