Plan: Final 4-Agent Orchestrated Validator              
                                                         
 Context                                                 
                                                       
 The startup-idea validator currently runs a single
 Market Analyst agent at POST /agents/market-analyst,
 and the frontend (frontend/src/App.jsx) renders one
 card from its response. The product spec calls for four
  specialized VC-style agents that run in parallel, an
 orchestrator that asks clarifying questions
 sequentially for any agent below 35% confidence
 (lowest-confidence-first), re-runs that agent with the
 answer as context, and finally produces a synthesized
evaluation with feedback and a final confidence score out of 100%.

 In addition, the existing frontend has a contract bug:
 it sends { prompt } while the backend expects { idea }
 (App.jsx:26 ↔ validator.py:13). This refactor will
 replace the single-agent endpoint with the multi-stage
 flow and rewire the frontend end-to-end.

 Out of scope: server-side session storage (we keep the
 API stateless — frontend echoes the running state
 back), real financial modeling, multi-round agent
 debates.

 ---
 Backend design

 The 4 agents (backend/app/services/agents.py — new)

 Each agent is a single LLM call that returns insights,
 confidence, key risk, and a clarifying question (used
 only when confidence < 35).

 ┌───────────────────────┬───────────────────────────┐
 │      Domain key       │       Display name        │
 ├───────────────────────┼───────────────────────────┤
 │ problem_user          │ Problem & User Agent      │
 ├───────────────────────┼───────────────────────────┤
 │                       │ Competition,              │
 │ market_competition    │ Differentiation & Market  │
 │                       │ Agent                     │
 ├───────────────────────┼───────────────────────────┤
 │ business_distribution │ Business Model &          │
 │                       │ Distribution Agent        │
 ├───────────────────────┼───────────────────────────┤
 │ tech_product          │ Technical Feasibility &   │
 │                       │ Product Agent             │
 └───────────────────────┴───────────────────────────┘

 Verbatim system prompts from the user's message live in
  agents.py as module-level constants (typos in the
 user-supplied text are corrected: "succeeda real
 market" → "succeed in a real market"; "isaluate" → "is
 to evaluate"; "produxecution" → "product execution").
 Each prompt explicitly forbids the other domains and
 ends with the output spec {insights, confidence,
 key_risk, clarifying_question}.

 @dataclass
 class AgentSpec:
     domain: Literal["problem_user",
 "market_competition", "business_distribution",
 "tech_product"]
     name: str
     system_prompt: str

 class _AgentLLMOutput(BaseModel):  # private to
 agents.py — what the LLM emits
     insights: list[str]
     confidence: int
     key_risk: str
     clarifying_question: str  # always returned;
 orchestrator decides whether to surface it

 AGENTS: list[AgentSpec] = [...]  # the 4 specs

 Agent runner

 async def run_agent(spec: AgentSpec, idea: str,
 history: list[ClarifyingQA]) -> AgentResult
 async def run_all_agents_parallel(idea: str, history:
 list[ClarifyingQA]) -> list[AgentResult]

 - run_agent builds a prompt: {system_prompt}\n\nStartup
  idea: {idea}\n\n{rendered Q&A history if any} and
 calls the existing
 services/gemini_client.generate_json(prompt,
 _AgentLLMOutput) (returns a Pydantic instance —
 confirmed at gemini_client.py:25). It then constructs
 AgentResult(domain=..., name=..., **out.model_dump()).
 - run_all_agents_parallel uses
 asyncio.gather(*[run_agent(s, idea, history) for s in
 AGENTS], return_exceptions=True). On failure for an
 individual agent it returns a placeholder
 AgentResult(confidence=0, insights=["(agent failed)"],
 key_risk="...", clarifying_question="") so a
 single-agent failure doesn't fail the whole request.

 Orchestrator helpers
 (backend/app/services/orchestrator.py — new)

 Pure-Python, no LLM calls:

 CONFIDENCE_THRESHOLD = 35

 def pending_domains(agents: list[AgentResult]) ->
 list[str]:
     """Domains with confidence < threshold, sorted
 lowest→highest. Ties broken by AGENTS list order."""

 Re-synthesis policy (per user's choice): when a
 clarifying answer arrives, only the clarified agent is
 re-run with the appended Q&A history. Other agents'
 results are preserved verbatim. The verdict step
 (below) then synthesizes across all 4 final outputs.

 Verdict service (backend/app/services/verdict.py — new)

 class _VerdictLLMOutput(BaseModel):
     verdict: Literal["Invest", "Pass", "Needs Work"]
     top_risks: list[str]
     suggestions: list[str]
     summary: str

 async def generate_verdict(idea, agents, history) ->
 VerdictResponse

 Single LLM call via generate_json with a synthesis
 prompt that takes the idea, all 4 final agent outputs,
 and the full clarifying-Q&A history.

 Schemas (backend/app/schemas/validator.py — replace)

 The existing file has stale 3-agent literals and unused
  request/response shapes. Replace with:

 AgentDomain = Literal["problem_user",
 "market_competition", "business_distribution",
 "tech_product"]

 class ClarifyingQA(BaseModel):
     domain: AgentDomain
     question: str
     answer: str

 class AgentResult(BaseModel):
     domain: AgentDomain
     name: str
     insights: list[str]
     confidence: int
     key_risk: str
     clarifying_question: str  # always present; surface
  only when confidence < 35

 class AnalyzeRequest(BaseModel):
     idea: str

 class AnalyzeResponse(BaseModel):
     agents: list[AgentResult]
     pending_domains: list[AgentDomain]  # ordered
 lowest-confidence first

 class ClarifyRequest(BaseModel):
     idea: str
     agents: list[AgentResult]
     history: list[ClarifyingQA]
     domain: AgentDomain
     question: str
     answer: str

 class ClarifyResponse(BaseModel):
     agents: list[AgentResult]
     pending_domains: list[AgentDomain]
     history: list[ClarifyingQA]

 class VerdictRequest(BaseModel):
     idea: str
     agents: list[AgentResult]
     history: list[ClarifyingQA]

 class VerdictResponse(BaseModel):
     verdict: Literal["Invest", "Pass", "Needs Work"]
     top_risks: list[str]
     suggestions: list[str]
     summary: str

 Routes (backend/app/routes/analyze_routes.py — new,
 replaces agent_routes.py)

 router = APIRouter(prefix="/api", tags=["analyze"])

 @router.post("/analyze",
 response_model=AnalyzeResponse)        # Stage 1
 @router.post("/clarify",
 response_model=ClarifyResponse)        # Stage 2
 (called per question)
 @router.post("/verdict",
 response_model=VerdictResponse)        # Stage 3

 Logic:
 - /analyze: agents = await
 run_all_agents_parallel(idea, []) → return
 AnalyzeResponse(agents, pending_domains(agents)).
 - /clarify: append the new ClarifyingQA to history,
 call run_agent for the matching AgentSpec, replace that
  agent in the list, return updated state. Frontend
 keeps calling /clarify until pending_domains is empty.
 - /verdict: await generate_verdict(...) and return.

 Files affected (backend)

 ┌─────────┬─────────────────────────────────────────┐
 │ Action  │                  Path                   │
 ├─────────┼─────────────────────────────────────────┤
 │ Add     │ backend/app/services/agents.py          │
 ├─────────┼─────────────────────────────────────────┤
 │ Add     │ backend/app/services/orchestrator.py    │
 ├─────────┼─────────────────────────────────────────┤
 │ Add     │ backend/app/services/verdict.py         │
 ├─────────┼─────────────────────────────────────────┤
 │ Add     │ backend/app/routes/analyze_routes.py    │
 ├─────────┼─────────────────────────────────────────┤
 │ Replace │ backend/app/schemas/validator.py        │
 ├─────────┼─────────────────────────────────────────┤
 │ Delete  │ backend/app/services/market_analyst.py  │
 │         │ (superseded; only used by agent_routes) │
 ├─────────┼─────────────────────────────────────────┤
 │ Delete  │ backend/app/routes/agent_routes.py      │
 │         │ (superseded by analyze_routes)          │
 ├─────────┼─────────────────────────────────────────┤
 │         │ backend/app/main.py — drop              │
 │ Modify  │ agent_router, mount analyze_router,     │
 │         │ keep speech_router untouched            │
 └─────────┴─────────────────────────────────────────┘

 backend/app/services/gemini_client.py is reused as-is.
 speech_routes.py, config.py, run.sh, requirement.txt
 unchanged.

 ---
 Frontend design

 The current frontend/src/App.jsx is a single ~200-line
 component with one card render path. Refactor in place
 (no new files) into a small state machine driven by a
 phase enum — keeps the diff focused.

 State

 const [phase, setPhase] = useState("idle");
 // phase: "idle" | "analyzing" | "clarifying" |
 "verdict-loading" | "done"
 const [idea, setIdea] = useState("");
 const [agents, setAgents] = useState([]);          //
 AgentResult[]
 const [pendingDomains, setPendingDomains] =
 useState([]);
 const [history, setHistory] = useState([]);        //
 ClarifyingQA[]
 const [currentAnswer, setCurrentAnswer] = useState("");
 const [verdict, setVerdict] = useState(null);     //
 VerdictResponse

 Flow

 1. idle → user types idea (or records via
 /speech/transcribe, unchanged) → submit → phase =
 "analyzing" → POST /api/analyze { idea } → set agents,
 pendingDomains. If pendingDomains.length === 0 jump to
 verdict; else phase = "clarifying".
 2. clarifying → render the 4 agent cards (always
 visible) plus a panel for the current clarifying
 question (pendingDomains[0]'s clarifying_question).
 User types answer → submit → POST /api/clarify { idea,
 agents, history, domain, question, answer } → replace
 agents and pendingDomains with the response. If
 pendingDomains non-empty, stay in this phase with the
 next question; else move to verdict.
 3. verdict-loading → POST /api/verdict { idea, agents,
 history } → set verdict → phase = "done".
 4. done → render verdict banner (Invest / Pass / Needs
 Work color-coded), summary, top_risks, suggestions,
 plus the final agent cards.

 Card rendering

 Replace the hardcoded single-card block
 (App.jsx:158-164) with agents.map(a => <AgentCard
 key={a.domain} agent={a} />). Each card shows name,
 confidence (numeric + simple bar), insights bullets,
 key risk. Inline a small AgentCard component within
 App.jsx to avoid new files.

 Contract fixes

 - Send { idea } (not { prompt }) — matches the new
 AnalyzeRequest.
 - Hardcoded http://localhost:8000 base URL stays
 (matches existing pattern at App.jsx:23,44).
 - Speech endpoint (/speech/transcribe) and its
 delivery-metrics rendering are untouched.

 Files affected (frontend)

 ┌────────┬──────────────────────────────────────────┐
 │ Action │                   Path                   │
 ├────────┼──────────────────────────────────────────┤
 │        │ frontend/src/App.jsx (state machine, 3   │
 │ Modify │ fetch calls, card map, clarifying panel, │
 │        │  verdict screen)                         │
 ├────────┼──────────────────────────────────────────┤
 │ Modify │ frontend/src/App.css (minor: agent-card  │
 │        │ grid, verdict banner colors)             │
 └────────┴──────────────────────────────────────────┘

 ---
 Reused utilities (no changes)

 - backend/app/services/gemini_client.py —
 generate_json(prompt, schema) returns a Pydantic
 instance (confirmed at gemini_client.py:17-25). All new
  agent/verdict calls go through this.
 - backend/app/config.py — settings.gemini_api_key reads
  from .env, no changes.
 - backend/run.sh — single-command launch, already
 executable from prior refactor.
 - frontend/src/App.jsx's existing MediaRecorder +
 /speech/transcribe pipeline.

 ---
 Verification

 1. Start services (two terminals):
   - cd backend && ./run.sh — confirms INFO: Application
  startup complete on port 8000.
   - cd frontend && npm run dev — confirms Vite dev
 server on port 5173.
 2. Backend smoke (curl):
 curl -s -X POST http://localhost:8000/api/analyze \
   -H 'Content-Type: application/json' \
   -d '{"idea":"An app that helps freelance designers
 send polished invoices in 30 seconds."}' | jq
 2. Expect: agents array of length 4 with the 4 domain
 keys, integer confidences 0–100, each with
 insights/key_risk/clarifying_question; pending_domains
 ordered ascending by confidence among domains < 35.
 3. Clarify smoke: pick a domain from
 pending_domains[0], send its clarifying_question plus a
  fake answer to POST /api/clarify. Expect that domain's
  confidence to update and pending_domains to shrink.
 4. Verdict smoke: with pending_domains = [], POST
 /api/verdict and assert response has verdict ∈ {Invest,
  Pass, Needs Work}, non-empty top_risks, suggestions,
 summary.
 5. Failure isolation: temporarily set
 GEMINI_API_KEY=bad and re-run /api/analyze. Expect HTTP
  200 with 4 placeholder agents (confidence: 0,
 insights: ["(agent failed)"]), not a 500.
 6. End-to-end UI walkthrough (the spec is UI-driven, so
  this is the real test):
   - Type a deliberately-vague idea ("AI for stuff") →
 submit → see 4 agent cards, several with low
 confidence.
   - Verify clarifying questions appear one at a time,
 lowest confidence first.
   - Answer each in turn; confirm card for that domain
 updates between questions.
   - After the last clarification, verdict screen
  Pass, Needs Work}, non-empty top_risks, suggestions,
 summary.
 5. Failure isolation: temporarily set
 GEMINI_API_KEY=bad and re-run /api/analyze. Expect HTTP
  200 with 4 placeholder agents (confidence: 0,
 insights: ["(agent failed)"]), not a 500.
 6. End-to-end UI walkthrough (the spec is UI-driven, so
  this is the real test):
   - Type a deliberately-vague idea ("AI for stuff") →
 submit → see 4 agent cards, several with low
 confidence.
   - Verify clarifying questions appear one at a time,
 lowest confidence first.
   - Answer each in turn; confirm card for that domain
 updates between questions.
   - After the last clarification, verdict screen
 renders with verdict, summary, top_risks, suggestions.
   - Type a strong, specific idea → confirm zero
 clarifying questions appear and the flow jumps straight
  to the verdict.
   - Confirm the speech-to-text "Record" button still
 populates the textarea (regression check).


