import json
from openai import AsyncOpenAI
from pydantic import BaseModel
from app.config import settings

_client: AsyncOpenAI | None = None

_MOCK_AGENT_OUTPUT = {
    "insights": [
        "Mock insight: strong problem-solution fit detected.",
        "Mock insight: addressable market appears substantial.",
        "Mock insight: technical approach is feasible with existing tools.",
    ],
    "confidence": 72,
    "key_risk": "Mock risk: early market adoption may be slower than projected.",
    "clarifying_question": "Who is your primary target customer and what does their current workflow look like?",
}

_MOCK_VERDICT_OUTPUT = {
    "verdict": "Needs Work",
    "confidence_score": 65,
    "top_risks": ["Mock risk: market validation needed", "Mock risk: competitive moat unclear"],
    "suggestions": ["Mock suggestion: run 10 user interviews first", "Mock suggestion: define pricing early"],
    "takeaway": "Promising concept — needs sharper positioning and customer validation before investing.",
    "summary": "Mock summary: the idea addresses a real pain point but faces execution risk.",
    "strengths": ["Mock strength: clear user pain point", "Mock strength: scalable model"],
    "insight": "Mock insight: focus on one vertical first to reduce complexity.",
    "strengthen": ["Mock: narrow the ICP", "Mock: validate willingness to pay"],
    "next_steps": ["Mock: talk to 10 potential users", "Mock: build a landing page MVP"],
}


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com",
        )
    return _client


async def generate_json(prompt: str, schema: type) -> BaseModel:
    if settings.mock_llm:
        # Pick the right mock payload based on which schema is being used
        from app.services.verdict import _VerdictLLMOutput  # local import to avoid circular
        mock_data = _MOCK_VERDICT_OUTPUT if schema is _VerdictLLMOutput else _MOCK_AGENT_OUTPUT
        return schema(**{k: v for k, v in mock_data.items() if k in schema.model_fields})

    client = get_client()
    response = await client.chat.completions.create(
        model="deepseek-v4-flash",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    return schema(**data)
