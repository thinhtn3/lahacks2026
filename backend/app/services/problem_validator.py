import os
import json
from google import genai

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


SYSTEM_PROMPT = """You are a Problem Validator agent evaluating startup ideas.

Given a startup idea, respond ONLY with valid JSON in this exact shape:
{
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "confidence": <integer 0-100>,
  "key_risk": "<one key risk>"
}

Guidelines:
- insights: 2-3 bullet insights about whether the problem is real, who experiences it, and how painful it is
- confidence: your confidence that the problem is real and worth solving (0 = not a real problem, 100 = urgent widespread pain)
- key_risk: the single biggest risk that this problem isn't actually worth solving

Do not include any text outside the JSON object."""


async def validate_problem(prompt: str) -> dict:
    client = _get_client()
    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
        contents=f"{SYSTEM_PROMPT}\n\nStartup idea: {prompt}",
    )
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
