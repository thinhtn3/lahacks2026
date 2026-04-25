# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

A startup idea validator powered by 3 parallel AI agents. Users describe a startup idea, three agents analyze it simultaneously, the system asks one clarifying question, then delivers a final verdict (Invest / Pass / Needs Work).

**Agents (run in parallel):**
- **Problem Validator** — is the problem real and worth solving?
- **Market Analyst** — is there a viable market?
- **Risk Analyst** — what are the key risks? (main differentiator)

**Each agent outputs:** 2–3 bullet insights, a confidence score (0–100), and 1 key risk.

**Full flow:** Input → parallel agent analysis → show agent cards → 1 clarifying question → user responds → light agent rerun with updated insights → final verdict + top risks + suggestions.

**Must-have features:** input box, agent cards, confidence scores, 1 follow-up question, final verdict.
**Nice-to-have:** agent disagreement highlight, confidence delta after clarifying answer.
**Out of scope:** multi-round debates, real financial modeling, external data integrations.

## Project Structure

This is a full-stack web app with a React frontend and a Python backend:

- `frontend/` — React 19 + Vite app
- `backend/` — Python API with a FastAPI-style layout
  - `backend/app/main.py` — app entry point
  - `backend/app/models/` — ORM or data models
  - `backend/app/schemas/` — Pydantic (or similar) request/response schemas
  - `backend/app/routes/` — route handlers
  - `backend/app/services/` — business logic
  - `backend/app/utils/` — shared utilities
  - `backend/requirement.txt` — Python dependencies
  - `backend/.env` — environment variables (not committed)

## Frontend

```bash
cd frontend
npm install       # install dependencies
npm run dev       # start dev server (http://localhost:5173)
npm run build     # production build
npm run lint      # ESLint
npm run preview   # preview production build
```

## Backend

```bash
cd backend
pip install -r requirement.txt   # install dependencies
uvicorn app.main:app --reload    # start dev server (assumed FastAPI)
```

Environment variables go in `backend/.env`.
