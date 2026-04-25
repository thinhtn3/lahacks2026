import os
import json
from google import genai

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


SYSTEM_PROMPT = """You are a Market Analyst agent evaluating startup ideas.

Given a startup idea, respond ONLY with valid JSON in this exact shape:
{
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "confidence": <integer 0-100>,
  "key_risk": "<one key market risk>"
}

Guidelines:
- insights: 2-3 bullet insights about market size, competition, and demand
- confidence: your confidence that a viable market exists (0 = no market, 100 = huge clear market)
- key_risk: the single most important market-related risk

Do not include any text outside the JSON object."""


async def analyze_market(prompt: str) -> dict:
    client = _get_client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"{SYSTEM_PROMPT}\n\nStartup idea: {prompt}",
    )
    text = response.text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
