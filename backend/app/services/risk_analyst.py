import os
import json
from google import genai

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


SYSTEM_PROMPT = """You are a Risk Analyst agent evaluating startup ideas. This is your key differentiator — go deeper than surface-level risks.

Given a startup idea, respond ONLY with valid JSON in this exact shape:
{
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "confidence": <integer 0-100>,
  "key_risk": "<one key risk>"
}

Guidelines:
- insights: 2-3 sharp insights covering technical, regulatory, or execution risks that most people overlook
- confidence: your confidence that the risk profile is manageable (0 = extremely risky, 100 = very low risk)
- key_risk: the single most critical risk that could kill this startup

Do not include any text outside the JSON object."""


async def analyze_risk(prompt: str) -> dict:
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
