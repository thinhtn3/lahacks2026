from pydantic import BaseModel
from app.schemas.validator import AgentResult
from app.services.gemini_client import generate_json


class _ClarifierOutput(BaseModel):
    question: str


async def generate_conflict_question(idea: str, agents: list[AgentResult], conflict_summary: str) -> str:
    summary = "\n".join(
        f"- {a.name} (confidence {a.confidence}/100): {'; '.join(a.insights)} | Key risk: {a.key_risk}"
        for a in agents
    )
    prompt = f"""\
You are a startup advisor. Three expert agents analyzed the same idea and reached conflicting conclusions.

Idea: {idea}

Agent results:
{summary}

Conflict identified: {conflict_summary}

Ask ONE direct question to the founder that would resolve this specific conflict. \
The answer should help determine which agent's view is more accurate. \
Do not mention the agents by name. Do not explain your reasoning — return only the question."""

    raw = await generate_json(prompt, _ClarifierOutput)
    return raw.question
