from typing import Literal

from pydantic import BaseModel

from app.schemas.validator import AgentResult, ClarifyingQA, VerdictResponse
from app.services.gemini_client import generate_json

_SYSTEM_PROMPT = """You are a senior venture capitalist synthesizing a multi-agent analysis of a startup idea.

You have received evaluations from four specialized agents:
- Problem & User Agent
- Competition, Differentiation & Market Agent
- Business Model & Distribution Agent
- Technical Feasibility & Product Agent

Your job is to produce a final investment verdict based on their combined findings.

You must:
- Weigh all four agent evaluations fairly
- Identify the top 2-3 cross-cutting risks
- Provide 2-3 actionable suggestions for the founder
- Write a 2-3 sentence summary of the overall opportunity
- Render a verdict: "Invest" (strong across all dimensions), "Needs Work" (promising but clear gaps), or "Pass" (fundamental problems)
- Produce an overall confidence score (0–100) reflecting how confident you are this startup can succeed

Respond ONLY with a JSON object with these exact fields:
{
  "verdict": "Invest" | "Pass" | "Needs Work",
  "confidence_score": <integer 0-100>,
  "top_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]
}
Do not include any text outside the JSON object."""


class _VerdictLLMOutput(BaseModel):
    verdict: Literal["Invest", "Pass", "Needs Work"]
    confidence_score: int
    top_risks: list[str]
    suggestions: list[str]


def _render_agents(agents: list[AgentResult]) -> str:
    lines = []
    for a in agents:
        lines.append(f"\n[{a.name}] confidence={a.confidence}/100")
        for insight in a.insights:
            lines.append(f"  • {insight}")
        lines.append(f"  Key risk: {a.key_risk}")
    return "\n".join(lines)


def _render_history(history: list[ClarifyingQA]) -> str:
    if not history:
        return ""
    lines = ["\n\nClarifying Q&A:"]
    for qa in history:
        lines.append(f"Q ({qa.domain}): {qa.question}")
        lines.append(f"A: {qa.answer}")
    return "\n".join(lines)


async def generate_verdict(
    idea: str,
    agents: list[AgentResult],
    history: list[ClarifyingQA],
) -> VerdictResponse:
    prompt = (
        f"{_SYSTEM_PROMPT}\n\n"
        f"Startup idea: {idea}\n\n"
        f"Agent evaluations:{_render_agents(agents)}"
        f"{_render_history(history)}"
    )
    out = await generate_json(prompt, _VerdictLLMOutput)
    return VerdictResponse(**out.model_dump())
