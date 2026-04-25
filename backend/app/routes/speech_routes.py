import os
import re
from typing import Any, Optional

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(prefix="/speech", tags=["speech"])

_FILLER_RE = re.compile(r"\b(um+|uh+|erm+|like|you know|sort of|kind of)\b", re.IGNORECASE)

# Keep the heuristics transparent and easy to tune.
_PAUSE_S_THRESHOLD = 0.8
_FILLER_PENALTY = 4
_PAUSE_PENALTY = 6
_PACE_LOW_WPM = 110
_PACE_HIGH_WPM = 190
_PACE_PENALTY = 10

_PACE_VERY_LOW_WPM = 90
_PACE_VERY_HIGH_WPM = 220
_FILLERS_MED = 2
_FILLERS_HIGH = 5
_PAUSES_MED = 1
_PAUSES_HIGH = 3


def _extract_timed_words(words: Any) -> list[dict[str, Any]]:
    if not isinstance(words, list):
        return []
    return [
        w
        for w in words
        if isinstance(w, dict)
        and isinstance(w.get("text"), str)
        and isinstance(w.get("start"), (int, float))
        and isinstance(w.get("end"), (int, float))
    ]


def _count_long_pauses(timed_words: list[dict[str, Any]]) -> int:
    pauses = 0
    prev_end = None
    for w in timed_words:
        start = float(w["start"])
        if prev_end is not None:
            if start - prev_end >= _PAUSE_S_THRESHOLD:
                pauses += 1
        prev_end = float(w["end"])
    return pauses


def _estimate_wpm(timed_words: list[dict[str, Any]]) -> Optional[int]:
    if not timed_words:
        return None
    duration_s = max(0.01, float(timed_words[-1]["end"]) - float(timed_words[0]["start"]))
    return int(round((len(timed_words) / duration_s) * 60))


def _pace_label(wpm: Optional[int]) -> str:
    if not isinstance(wpm, int):
        return "Unknown"
    if wpm < _PACE_VERY_LOW_WPM:
        return "Very slow"
    if wpm < _PACE_LOW_WPM:
        return "Slow"
    if wpm <= _PACE_HIGH_WPM:
        return "Good"
    if wpm <= _PACE_VERY_HIGH_WPM:
        return "Fast"
    return "Very fast"


def _fillers_label(count: int) -> str:
    if count <= 0:
        return "None"
    if count <= _FILLERS_MED:
        return "Low"
    if count <= _FILLERS_HIGH:
        return "Medium"
    return "High"


def _pauses_label(count: int) -> str:
    if count <= 0:
        return "Smooth"
    if count <= _PAUSES_MED:
        return "Some"
    if count <= _PAUSES_HIGH:
        return "Choppy"
    return "Very choppy"


def _delivery_score(text: str, words: Optional[list[dict[str, Any]]]):
    """
    Tiny heuristic "delivery score" (0–100) + 1-sentence feedback.

    We keep this intentionally simple: filler words, long pauses (from word timestamps),
    and speaking rate (words/min). This is only a nice-to-have UI element.
    """
    t = (text or "").strip().lower()

    # Filler words / hesitations.
    filler_count = len(_FILLER_RE.findall(t))

    timed_words = _extract_timed_words(words)
    long_pauses = _count_long_pauses(timed_words) if timed_words else 0
    wpm = _estimate_wpm(timed_words)
    pace_label = _pace_label(wpm)
    fillers_label = _fillers_label(filler_count)
    pauses_label = _pauses_label(long_pauses)

    score = 100
    score -= filler_count * _FILLER_PENALTY
    score -= long_pauses * _PAUSE_PENALTY

    if isinstance(wpm, int):
        if wpm < _PACE_LOW_WPM or wpm > _PACE_HIGH_WPM:
            score -= _PACE_PENALTY

    score = max(0, min(100, int(round(score))))

    # Evidence-backed, single-sentence feedback that always covers:
    # - filler words
    # - long pauses
    # - pace (wpm)
    pace_text = f"{pace_label} (~{wpm} wpm)" if isinstance(wpm, int) else pace_label
    evidence = (
        f"Pace: {pace_text}; fillers: {fillers_label} ({filler_count}); pauses: {pauses_label} ({long_pauses})."
    )

    # One actionable tweak based on the biggest issue.
    if filler_count >= _FILLERS_HIGH:
        tip = "Try replacing “um/uh/like” with a silent pause to sound more confident."
    elif long_pauses >= _PAUSES_HIGH:
        tip = "Try connecting sentences more smoothly to keep momentum."
    elif isinstance(wpm, int) and wpm > _PACE_HIGH_WPM:
        tip = "Slow down slightly so key points land clearly."
    elif isinstance(wpm, int) and wpm < _PACE_LOW_WPM:
        tip = "Tighten delivery a bit to keep energy up."
    else:
        tip = "Keep the pace steady and lead with your main claim early."

    feedback = f"{evidence} {tip}"

    return score, feedback


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Speech-to-Text endpoint.

    Frontend records audio in the browser and uploads it as multipart/form-data.
    Forward the bytes to ElevenLabs and return text.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            # This app uses python-dotenv in `app/main.py` to load `backend/.env` on startup.
            detail="Missing ELEVENLABS_API_KEY (add it to backend/.env and restart the backend).",
        )

    # Read the uploaded recording (webm/wav/m4a/etc).
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    # ElevenLabs Speech-to-Text (Scribe v2) endpoint.
    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {"xi-api-key": api_key}  # ElevenLabs uses `xi-api-key` auth header.

    # Simplest request: multipart fields { file, model_id }.
    # We also ask for word timestamps so we can compute a lightweight delivery score.
    data = {"model_id": "scribe_v2", "timestamps_granularity": "word"}
    files = {
        "file": (
            file.filename or "pitch.webm",
            audio_bytes,
            file.content_type or "application/octet-stream",
        )
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, data=data, files=files)
    except httpx.HTTPError as e:
        # Provider unreachable / timeout / SSL issues / etc.
        raise HTTPException(status_code=502, detail=f"ElevenLabs request failed: {e}") from e

    if resp.status_code >= 400:
        # Keep it simple: bubble up the provider error body for debugging.
        raise HTTPException(status_code=502, detail=f"ElevenLabs error {resp.status_code}: {resp.text}")

    payload = resp.json()

    # ElevenLabs returns a top-level `text` for typical (single-channel) uploads.
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=502, detail=f"Unexpected ElevenLabs response shape: {payload}")

    score, feedback = _delivery_score(text, payload.get("words"))
    timed_words = _extract_timed_words(payload.get("words"))
    wpm = _estimate_wpm(timed_words)
    filler_count = len(_FILLER_RE.findall((text or "").strip().lower()))
    long_pauses = _count_long_pauses(timed_words) if timed_words else 0

    return {
        "text": text,
        "delivery_score": score,
        "delivery_feedback": feedback,
        "delivery_metrics": {
            "pace": {"wpm": wpm, "label": _pace_label(wpm)},
            "fillers": {"count": filler_count, "label": _fillers_label(filler_count)},
            "pauses": {"count": long_pauses, "label": _pauses_label(long_pauses)},
        },
    }