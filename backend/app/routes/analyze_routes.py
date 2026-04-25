from fastapi import APIRouter, HTTPException

from app.schemas.validator import (
    AnalyzeRequest,
    AnalyzeResponse,
    ClarifyRequest,
    ClarifyResponse,
    ClarifyingQA,
    VerdictRequest,
    VerdictResponse,
)
from app.services.agents import run_all_agents_parallel, run_single_agent
from app.services.orchestrator import pending_domains
from app.services.verdict import generate_verdict

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    try:
        agents = await run_all_agents_parallel(req.idea, history=[])
        return AnalyzeResponse(agents=agents, pending_domains=pending_domains(agents, history=[]))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clarify", response_model=ClarifyResponse)
async def clarify(req: ClarifyRequest):
    try:
        new_qa = ClarifyingQA(domain=req.domain, question=req.question, answer=req.answer)
        updated_history = req.history + [new_qa]
        updated_agent = await run_single_agent(req.domain, req.idea, updated_history)
        agents = [updated_agent if a.domain == req.domain else a for a in req.agents]
        return ClarifyResponse(
            agents=agents,
            pending_domains=pending_domains(agents, updated_history),
            history=updated_history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verdict", response_model=VerdictResponse)
async def verdict(req: VerdictRequest):
    try:
        return await generate_verdict(req.idea, req.agents, req.history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
