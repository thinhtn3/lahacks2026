from typing import Literal
from pydantic import BaseModel
from app.schemas.validator import AgentResult
from app.services.gemini_client import generate_json


class _VerdictOutput(BaseModel):
    verdict: Literal["Invest", "Pass", "Needs Work"]
    top_risks: list[str]
    suggestions: list[str]


async def generate_verdict(idea: str, clarifying_qa: str, agents: list[AgentResult]) -> dict:
    summary = "\n".join(
        f"- {a.name} (confidence {a.confidence}/100): {'; '.join(a.insights)} | Key risk: {a.key_risk}"
        for a in agents
    )
    prompt = f"""\
You are a startup investment committee making a final recommendation.

Idea: {idea}

Clarifying exchange:
{clarifying_qa}

Updated agent analysis:
{summary}

Based on all of the above, provide a verdict using exactly these criteria:
- Invest: strong problem validation, viable market, and manageable risks across the board
- Pass: a fundamental flaw in problem, market, or risk that disqualifies the idea as-is
- Needs Work: promising core idea but requires specific improvements before it is fundable

Also provide:
- top_risks: 2-4 concrete, specific risks (not generic platitudes)
- suggestions: 2-4 actionable next steps the founder should take immediately

Be direct and specific. Do not hedge."""

    raw = await generate_json(prompt, _VerdictOutput)
    return {"verdict": raw.verdict, "top_risks": raw.top_risks, "suggestions": raw.suggestions}
