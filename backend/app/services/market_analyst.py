from pydantic import BaseModel
from typing import List
from app.services.gemini_client import generate_json
from app.schemas.validator import AgentResult

_SYSTEM_PROMPT = """You are a Market Analyst agent evaluating startup ideas.

Analyze the market viability of the given startup idea and respond with:
- insights: 2-3 bullet insights about market size, competition, and demand
- confidence: integer 0-100 (0 = no market, 100 = huge clear market)
- key_risk: the single most important market-related risk"""


class _MarketOutput(BaseModel):
    insights: List[str]
    confidence: int
    key_risk: str


async def analyze_market(idea: str) -> AgentResult:
    prompt = f"{_SYSTEM_PROMPT}\n\nStartup idea: {idea}"
    out = await generate_json(prompt, _MarketOutput)
    return AgentResult(name="Market Analyst", **out.model_dump())
