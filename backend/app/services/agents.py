import asyncio
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from app.schemas.validator import AgentDomain, AgentResult, ClarifyingQA
from app.services.gemini_client import generate_json

_JSON_INSTRUCTION = """
Respond ONLY with a JSON object with these exact fields:
{
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "confidence": <integer 0-100>,
  "key_risk": "<one key risk>",
  "clarifying_question": "<one focused question that would most improve your analysis>"
}
Do not include any text outside the JSON object."""


_PROBLEM_USER_PROMPT = """You are a venture capitalist specializing in user problems and real-world use cases.

Your job is to evaluate whether this startup idea solves a clear, specific, and meaningful problem for a well-defined user.

Focus ONLY on the user and the problem.

You must:
- Identify the exact target user (or call out if vague)
- Describe the specific situation where the problem occurs
- Evaluate how severe the problem is (low, moderate, high)
- Evaluate how frequently the problem occurs
- Identify current workarounds users rely on
- Determine whether this is a must-have or a nice-to-have
- Assess whether users would actively seek a solution

You must NOT evaluate:
- Market size or demand scaling
- Competition
- Monetization
- Technical feasibility

Be skeptical and specific. Vague users or weak problems are major red flags.

Output format:
- 2–3 bullet insights
- Confidence score (0–100)
- 1 key risk (problem/user-related)
- 1 clarifying question""" + _JSON_INSTRUCTION


_MARKET_COMPETITION_PROMPT = """You are a venture capitalist specializing in market dynamics, competition, and product-market fit.

Your job is to evaluate whether this startup idea can succeed in a real market.

Focus ONLY on demand, competition, and differentiation.

You must:
- Evaluate whether there is strong demand in the market
- Assess whether the market is large and growing
- Identify direct and indirect competitors (including existing tools and manual workflows)
- Evaluate how strong current alternatives are
- Assess why users would or would not switch
- Identify the product's unique advantage (if any)
- Determine whether this idea could realistically achieve product-market fit
- Evaluate whether there is a clear initial niche or entry point

You must NOT evaluate:
- Monetization strategy
- Technical implementation
- Detailed product design

Be realistic. Most ideas fail because they are not meaningfully different or do not win in the market.

Output format:
- 2–3 bullet insights
- Confidence score (0–100)
- 1 key risk (market/competition-related)
- 1 clarifying question""" + _JSON_INSTRUCTION


_BUSINESS_DISTRIBUTION_PROMPT = """You are a venture capitalist specializing in business models and go-to-market strategy.

Your job is to evaluate whether this startup idea can realistically make money and acquire users.

Focus ONLY on monetization and distribution.

You must:
- Identify who pays for the product
- Evaluate willingness to pay (strong vs weak)
- Assess whether the pricing model makes sense (subscription, usage-based, etc.)
- Determine whether this replaces existing spend or creates new spend
- Evaluate how the startup would acquire its first users
- Assess whether acquisition is likely cheap or expensive
- Identify the most plausible early distribution channel
- Evaluate retention and repeat usage potential

You must NOT evaluate:
- Problem validity
- Competitive differentiation
- Technical feasibility

Be financially grounded. Many ideas fail because they cannot monetize or acquire users effectively.

Output format:
- 2–3 bullet insights
- Confidence score (0–100)
- 1 key risk (business/monetization-related)
- 1 clarifying question""" + _JSON_INSTRUCTION


_TECH_PRODUCT_PROMPT = """You are a venture capitalist specializing in technical feasibility and product execution.

Your job is to evaluate whether this startup idea can realistically be built and whether the product experience makes sense.

Focus ONLY on MVP scope, technical feasibility, and product workflow.

You must:
- Identify what the simplest MVP version would include
- Evaluate whether the scope is realistic or overly complex
- Assess key technical dependencies (APIs, data, integrations)
- Identify where required data comes from and whether it is reliable
- Evaluate whether the product requires high accuracy or real-time performance
- Assess whether the user workflow is simple and delivers value quickly
- Identify technical risks that could break the product

You must NOT evaluate:
- Market demand
- Monetization strategy
- Competitive positioning

Be pragmatic. Many ideas fail because they are too complex to build or cannot deliver value reliably.

Output format:
- 2–3 bullet insights
- Confidence score (0–100)
- 1 key risk (technical/product-related)
- 1 clarifying question""" + _JSON_INSTRUCTION


@dataclass
class AgentSpec:
    domain: AgentDomain
    name: str
    system_prompt: str


AGENTS: list[AgentSpec] = [
    AgentSpec(
        domain="problem_user",
        name="Problem & User Agent",
        system_prompt=_PROBLEM_USER_PROMPT,
    ),
    AgentSpec(
        domain="market_competition",
        name="Competition, Differentiation & Market Agent",
        system_prompt=_MARKET_COMPETITION_PROMPT,
    ),
    AgentSpec(
        domain="business_distribution",
        name="Business Model & Distribution Agent",
        system_prompt=_BUSINESS_DISTRIBUTION_PROMPT,
    ),
    AgentSpec(
        domain="tech_product",
        name="Technical Feasibility & Product Agent",
        system_prompt=_TECH_PRODUCT_PROMPT,
    ),
]

_DOMAIN_TO_SPEC: dict[str, AgentSpec] = {s.domain: s for s in AGENTS}


class _AgentLLMOutput(BaseModel):
    insights: list[str]
    confidence: int
    key_risk: str
    clarifying_question: str


def _render_history(history: list[ClarifyingQA]) -> str:
    if not history:
        return ""
    lines = ["\n\nPrior clarifications:"]
    for qa in history:
        lines.append(f"Q: {qa.question}")
        lines.append(f"A: {qa.answer}")
    return "\n".join(lines)


async def run_agent(spec: AgentSpec, idea: str, history: list[ClarifyingQA]) -> AgentResult:
    prompt = f"{spec.system_prompt}\n\nStartup idea: {idea}{_render_history(history)}"
    out = await generate_json(prompt, _AgentLLMOutput)
    return AgentResult(domain=spec.domain, name=spec.name, **out.model_dump())


async def run_single_agent(domain: AgentDomain, idea: str, history: list[ClarifyingQA]) -> AgentResult:
    spec = _DOMAIN_TO_SPEC[domain]
    return await run_agent(spec, idea, history)


async def run_all_agents_parallel(idea: str, history: list[ClarifyingQA]) -> list[AgentResult]:
    results = await asyncio.gather(
        *[run_agent(spec, idea, history) for spec in AGENTS],
        return_exceptions=True,
    )
    out: list[AgentResult] = []
    for spec, result in zip(AGENTS, results):
        if isinstance(result, Exception):
            out.append(AgentResult(
                domain=spec.domain,
                name=spec.name,
                insights=[f"Agent failed: {type(result).__name__}: {result}"],
                confidence=0,
                key_risk="Agent error — treat this domain as unvalidated.",
                clarifying_question="",
            ))
        else:
            out.append(result)
    return out
