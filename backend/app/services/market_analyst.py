from pydantic import BaseModel
from typing import List
from app.services.gemini_client import generate_json
from app.schemas.validator import AgentResult
from app.services.prompts import build_system_prompt

_SYSTEM_PROMPT = build_system_prompt("market_competition_pmf")


class _MarketOutput(BaseModel):
    insights: List[str]
    confidence: int
    key_risk: str


async def analyze_market(idea: str) -> AgentResult:
    prompt = f"{_SYSTEM_PROMPT}\n\nStartup idea: {idea}"
    out = await generate_json(prompt, _MarketOutput)
    return AgentResult(name="Market Analyst", **out.model_dump())
