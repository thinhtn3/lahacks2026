# Startup Idea Validator

Pitch a startup idea and get an instant multi-agent analysis — Problem, Market, and Risk agents run in parallel, ask one clarifying question, then render a final verdict: **Invest / Needs Work / Pass**.

## What it does

1. User describes their startup idea (text or voice)
2. Four AI agents analyze it in parallel (problem/user fit, market, business model, technical feasibility)
3. The panel asks one clarifying question to sharpen the analysis
4. A final verdict is generated with confidence score, top risks, and next steps

## Stack

- **Frontend** — React + Vite + TypeScript + Tailwind + shadcn/ui (`project-code/`)
- **Backend** — Python + FastAPI + DeepSeek LLM + Tavily web search + ElevenLabs speech-to-text

## Getting started

**Backend**
```bash
cd backend
pip install -r requirement.txt
cp .env.example .env   # fill in your keys
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd project-code
npm install
npm run dev   # http://localhost:5173
```

## Environment variables

Create `backend/.env`:

```
DEEPSEEK_API_KEY=...       # LLM for agent analysis
TAVILY_API_KEY=...         # Web search for market research
ELEVENLABS_API_KEY=...     # Speech-to-text (voice pitch input)
MOCK_LLM=true              # Skip all external APIs in dev
```

## Project structure

```
├── project-code/   React frontend (the UI)
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/     API endpoints
│   │   ├── services/   Agent logic, LLM, search, speech
│   │   └── schemas/    Pydantic models
│   └── requirement.txt
└── CLAUDE.md       Codebase guidance
```
