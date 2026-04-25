from typing import Optional
from pydantic import BaseModel
from app.schemas.validator import AgentResult, ConflictResult
from app.services.gemini_client import generate_json


class _ConflictOutput(BaseModel):
    has_conflict: bool
    conflict_summary: Optional[str] = None


async def detect_conflicts(idea: str, agents: list[AgentResult]) -> ConflictResult:
    summary = "\n".join(
        f"- {a.name} (confidence {a.confidence}/100): {'; '.join(a.insights)} | Key risk: {a.key_risk}"
        for a in agents
    )
    prompt = f"""\
You are an orchestrator reviewing three expert agents who independently analyzed the same startup idea.

Idea: {idea}

Agent results:
{summary}

Determine whether a meaningful conflict exists between the agents. A conflict exists when:
- Any two agents have a confidence gap greater than 35 points
- Agents explicitly contradict each other on the same dimension (market viability, problem severity, risk level)
- One agent's key risk directly undermines another agent's positive insight

If has_conflict is true, set conflict_summary to a 1-2 sentence plain-English description of what the agents disagree on.
If has_conflict is false, set conflict_summary to null.

Return only the JSON."""

    raw = await generate_json(prompt, _ConflictOutput)
    return ConflictResult(has_conflict=raw.has_conflict, conflict_summary=raw.conflict_summary)
