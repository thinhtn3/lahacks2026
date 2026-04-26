import asyncio
from collections.abc import Callable
from dataclasses import dataclass

from pydantic import BaseModel

from app.schemas.validator import AgentDomain, AgentResult, ClarifyingQA
from app.services.gemini_client import generate_json
from app.services.prompts import build_system_prompt
from app.services.web_search import deep_research, market_search

_SEARCH_CONFIGS: dict[AgentDomain, list[tuple[Callable, str]]] = {
    "market_competition": [
        (market_search, "{term} market size growth trends 2026"),
        (deep_research, "{term} top competitors funding landscape 2026"),
    ],
    "business_distribution": [
        (market_search, "{term} pricing model CAC LTV revenue benchmarks 2026"),
    ],
}


@dataclass
class AgentSpec:
    domain: AgentDomain
    name: str
    system_prompt: str


AGENTS: list[AgentSpec] = [
    AgentSpec(
        domain="problem_user",
        name="Problem & User Agent",
        system_prompt=build_system_prompt("problem_user"),
    ),
    AgentSpec(
        domain="market_competition",
        name="Competition, Differentiation & Market Agent",
        system_prompt=build_system_prompt("market_competition"),
    ),
    AgentSpec(
        domain="business_distribution",
        name="Business Model & Distribution Agent",
        system_prompt=build_system_prompt("business_distribution"),
    ),
    AgentSpec(
        domain="tech_product",
        name="Technical Feasibility & Product Agent",
        system_prompt=build_system_prompt("tech_product"),
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


async def _get_search_context_and_sources(
    domain: AgentDomain, idea: str
) -> tuple[str, list[dict]]:
    configs = _SEARCH_CONFIGS.get(domain)
    if not configs:
        return "", []
    term = idea[:150]
    raw = await asyncio.gather(*[fn(q.format(term=term)) for fn, q in configs])
    context_parts, all_sources = [], []
    for text, sources in raw:
        if text:
            context_parts.append(text)
        all_sources.extend(sources)
    combined = "\n\n".join(context_parts)
    return (f"\n\n{combined}" if combined else ""), all_sources


async def run_agent(
    spec: AgentSpec, idea: str, history: list[ClarifyingQA]
) -> AgentResult:
    search_context, sources = await _get_search_context_and_sources(spec.domain, idea)
    prompt = f"{spec.system_prompt}\n\nStartup idea: {idea}{search_context}{_render_history(history)}"
    out = await generate_json(prompt, _AgentLLMOutput)
    return AgentResult(domain=spec.domain, name=spec.name, sources=sources, **out.model_dump())


async def run_single_agent(
    domain: AgentDomain, idea: str, history: list[ClarifyingQA]
) -> AgentResult:
    spec = _DOMAIN_TO_SPEC[domain]
    return await run_agent(spec, idea, history)


async def run_all_agents_parallel(
    idea: str, history: list[ClarifyingQA]
) -> list[AgentResult]:
    results = await asyncio.gather(
        *[run_agent(spec, idea, history) for spec in AGENTS],
        return_exceptions=True,
    )
    out: list[AgentResult] = []
    for spec, result in zip(AGENTS, results):
        if isinstance(result, Exception):
            out.append(
                AgentResult(
                    domain=spec.domain,
                    name=spec.name,
                    insights=[f"Agent failed: {type(result).__name__}: {result}"],
                    confidence=0,
                    key_risk="Agent error — treat this domain as unvalidated.",
                    clarifying_question="",
                )
            )
        else:
            out.append(result)
    return out
