import asyncio
from pydantic import BaseModel
from app.schemas.validator import AgentResult
from app.services.gemini_client import generate_json


class _AgentOutput(BaseModel):
    insights: list[str]
    confidence: int
    key_risk: str


_PROMPT_PROBLEM = """\
You are a Problem Validator agent evaluating startup ideas.

Assess whether the problem the startup addresses is real and worth solving.

Startup idea: {idea}{context}

Return JSON with:
- insights: 2-3 bullet insights about problem severity, frequency, and who experiences it
- confidence: 0-100 score for how real and worth-solving the problem is (0 = not a real problem, 100 = urgent widespread pain)
- key_risk: the single biggest risk that this problem isn't actually worth solving"""

_PROMPT_MARKET = """\
You are a Market Analyst agent evaluating startup ideas.

Assess whether there is a viable market for this startup.

Startup idea: {idea}{context}

Return JSON with:
- insights: 2-3 bullet insights about market size, competition, and demand
- confidence: 0-100 score for how viable the market is (0 = no market, 100 = huge clear market)
- key_risk: the single most important market-related risk"""

_PROMPT_RISK = """\
You are a Risk Analyst agent evaluating startup ideas. This is your key differentiator — go deeper than surface-level risks.

Identify the key risks that could cause this startup to fail.

Startup idea: {idea}{context}

Return JSON with:
- insights: 2-3 sharp insights covering technical, regulatory, or execution risks that most people overlook
- confidence: 0-100 score for how manageable the overall risk profile is (0 = extremely risky, 100 = very low risk)
- key_risk: the single most critical risk that could kill this startup"""


def _build_prompt(template: str, idea: str, clarifying_qa: str) -> str:
    context = f"\n\nAdditional context: {clarifying_qa}" if clarifying_qa else ""
    return template.format(idea=idea, context=context)


async def _run_agent(name: str, prompt: str) -> AgentResult:
    raw = await generate_json(prompt, _AgentOutput)
    return AgentResult(name=name, insights=raw.insights, confidence=raw.confidence, key_risk=raw.key_risk)


async def _safe_run(name: str, prompt: str) -> AgentResult:
    try:
        return await _run_agent(name, prompt)
    except Exception:
        return AgentResult(
            name=name,
            insights=["(agent unavailable — please retry)"],
            confidence=0,
            key_risk="Agent failed to respond",
        )


async def run_agents_parallel(idea: str, clarifying_qa: str = "") -> list[AgentResult]:
    return list(await asyncio.gather(
        _safe_run("Problem Validator", _build_prompt(_PROMPT_PROBLEM, idea, clarifying_qa)),
        _safe_run("Market Analyst",    _build_prompt(_PROMPT_MARKET,   idea, clarifying_qa)),
        _safe_run("Risk Analyst",      _build_prompt(_PROMPT_RISK,     idea, clarifying_qa)),
    ))
