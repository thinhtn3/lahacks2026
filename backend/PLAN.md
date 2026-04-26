# Backend Plan — Startup Idea Validator

## Context

The backend powers the flow described in `CLAUDE.md`:

1. User submits an idea → 3 agents (Problem Validator, Market Analyst, Risk Analyst) run **in parallel** → return cards + 1 clarifying question.
2. User answers the question → light agent rerun → final verdict (Invest / Pass / Needs Work) + top risks + suggestions.

### Decisions locked

- **Stateless** — frontend echoes prior agent results back on the second call. No DB, no session store.
- **LLM:** Gemini `gemini-2.5-flash` via `google-genai` SDK. API key placeholder in `backend/.env`.
- **Transport:** single JSON response per endpoint (no SSE for v1).
- **Output format:** Gemini structured output (`response_schema`) so each agent returns JSON matching our Pydantic shape — no fragile parsing.
- **No auth, no rate limiting, no persistence** beyond the in-flight request.

---

## Architecture

```
POST /api/analyze   ── runs 3 agents in parallel ── returns 3 cards + clarifying question
POST /api/verdict   ── reruns 3 agents with the clarifying Q&A ── returns updated cards + verdict
```

Both endpoints are async. `asyncio.gather` runs the 3 agents concurrently. A 4th call (clarifier on `/analyze`, verdict on `/verdict`) runs **after** the agents finish, since it needs their output.

Total wall time per endpoint ≈ slowest agent + final synthesis call ≈ 4–8 s with Flash.

---

## File layout

```
backend/
├── .env                        # GEMINI_API_KEY=YOUR_KEY_HERE
├── requirement.txt
└── app/
    ├── __init__.py
    ├── main.py                 # FastAPI app, CORS, router mount
    ├── config.py               # loads .env, exposes settings
    ├── routes/
    │   ├── __init__.py
    │   ├── analyze.py          # POST /api/analyze
    │   └── verdict.py          # POST /api/verdict
    ├── schemas/
    │   ├── __init__.py
    │   └── validator.py        # AgentResult, AnalyzeRequest/Response, VerdictRequest/Response
    ├── services/
    │   ├── __init__.py
    │   ├── gemini_client.py    # thin wrapper: generate_json(prompt, schema) → dict
    │   ├── agents.py           # 3 agent fns + run_agents_parallel()
    │   ├── clarifier.py        # generates 1 clarifying question
    │   └── verdict.py          # generates final verdict
    └── utils/
        └── __init__.py
```

---

## Schemas (`app/schemas/validator.py`)

```python
class AgentResult(BaseModel):
    name: Literal["Problem Validator", "Market Analyst", "Risk Analyst"]
    insights: list[str]            # 2–3 bullets
    confidence: int                # 0–100
    key_risk: str

class AnalyzeRequest(BaseModel):
    idea: str

class AnalyzeResponse(BaseModel):
    agents: list[AgentResult]      # length 3, fixed order
    clarifying_question: str

class VerdictRequest(BaseModel):
    idea: str
    prior_agents: list[AgentResult]
    clarifying_question: str
    clarifying_answer: str

class VerdictResponse(BaseModel):
    agents: list[AgentResult]      # updated cards
    verdict: Literal["Invest", "Pass", "Needs Work"]
    top_risks: list[str]
    suggestions: list[str]
```

Confidence delta (nice-to-have) is computed on the frontend by diffing `prior_agents[i].confidence` vs `agents[i].confidence`.

---

## Services

### `gemini_client.py`
- Initializes `google.genai.Client(api_key=settings.gemini_api_key)` once at import.
- `async generate_json(prompt, schema) -> dict` — calls `client.aio.models.generate_content` with `response_mime_type="application/json"` and `response_schema`. Raises `GeminiError` on failure.

### `agents.py`
- Three module-level prompt constants: `PROMPT_PROBLEM`, `PROMPT_MARKET`, `PROMPT_RISK`.
- `run_agent(name, prompt_template, idea, clarifying_qa=None) -> AgentResult`
- `async run_agents_parallel(idea, clarifying_qa=None) -> list[AgentResult]` via `asyncio.gather`.
- Per-agent failure returns a placeholder card (`confidence=0`, `insights=["(agent failed)"]`) so the UI always gets 3 cards.

### `clarifier.py`
- `async generate_clarifying_question(idea, agents) -> str`
- Feeds idea + agent summaries → asks Gemini for the single best follow-up question.

### `verdict.py`
- `async generate_verdict(idea, clarifying_qa, agents) -> dict`
- Returns `{verdict, top_risks, suggestions}` with structured output enforcing `verdict ∈ {Invest, Pass, Needs Work}`.

---

## Routes

### `POST /api/analyze`
```python
agents = await run_agents_parallel(idea)
question = await generate_clarifying_question(idea, agents)
return AnalyzeResponse(agents=agents, clarifying_question=question)
```

### `POST /api/verdict`
```python
qa = f"Q: {req.clarifying_question}\nA: {req.clarifying_answer}"
agents = await run_agents_parallel(req.idea, clarifying_qa=qa)
tail = await generate_verdict(req.idea, qa, agents)
return VerdictResponse(agents=agents, **tail)
```

---

## `main.py`

- `FastAPI(title="Idea Validator")`
- `CORSMiddleware` allowing `http://localhost:5173`
- Routers mounted under `/api`
- `GET /health` → `{"ok": true}`

## `requirement.txt`

```
fastapi
uvicorn[standard]
google-genai
pydantic
python-dotenv
```

## `.env`

```
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

---

## Verification

1. `pip install -r requirement.txt && uvicorn app.main:app --reload`
2. `GET /health` → `{"ok": true}`; `GET /docs` shows both endpoints.
3. Smoke `POST /api/analyze` with a sample idea — expect 3 agent cards + `clarifying_question`.
4. Feed response back to `POST /api/verdict` with a dummy answer — expect `verdict`, `top_risks`, `suggestions`.
5. Parallelism check: log timestamps inside `run_agent`; three start times within ~50 ms.

---

## Out of scope (v1)

- Streaming/SSE
- Persistence / history
- Auth, rate limiting
- Provider abstraction (Gemini-only for now)
- Frontend wiring
