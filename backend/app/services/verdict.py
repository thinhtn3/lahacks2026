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
- Render a verdict: "Invest" (strong across all dimensions), "Needs Work" (promising but clear gaps), or "Pass" (fundamental problems)
- Produce an overall confidence score (0–100) reflecting how confident you are this startup can succeed
- Write a compelling one-sentence takeaway for the founder
- Write a 2-3 sentence summary of the overall opportunity
- List 2-3 genuine strengths of the idea
- Write one sharp, memorable insight about the startup's key competitive edge or biggest bet
- List 2-3 concrete ways the founder can strengthen the idea
- List 3-5 specific next steps for the founder to take

Respond ONLY with a JSON object with these exact fields:
{
  "verdict": "Invest" | "Pass" | "Needs Work",
  "confidence_score": <integer 0-100>,
  "top_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "takeaway": "<one compelling sentence for the founder>",
  "summary": "<2-3 sentences on the overall opportunity>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "insight": "<one sharp insight about key edge or biggest bet>",
  "strengthen": ["<how to strengthen 1>", "<how to strengthen 2>", "<how to strengthen 3>"],
  "next_steps": ["<next step 1>", "<next step 2>", "<next step 3>", "<next step 4>"]
}
Do not include any text outside the JSON object."""


class _VerdictLLMOutput(BaseModel):
    verdict: Literal["Invest", "Pass", "Needs Work"]
    confidence_score: int
    top_risks: list[str]
    suggestions: list[str]
    takeaway: str
    summary: str
    strengths: list[str]
    insight: str
    strengthen: list[str]
    next_steps: list[str]


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
