import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.validator import (
    AgentResult,
    AnalyzeRequest,
    AnalyzeResponse,
    ClarifyRequest,
    ClarifyResponse,
    ClarifyingQA,
    VerdictRequest,
    VerdictResponse,
)
from app.services.agents import AGENTS, run_agent, run_all_agents_parallel, run_single_agent
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


@router.post("/analyze/stream")
async def analyze_stream(req: AnalyzeRequest):
    async def generator():
        queue: asyncio.Queue = asyncio.Queue()

        async def run_and_enqueue(spec):
            try:
                result = await run_agent(spec, req.idea, [])
            except Exception as e:
                result = AgentResult(
                    domain=spec.domain,
                    name=spec.name,
                    insights=[f"Agent failed: {type(e).__name__}: {e}"],
                    confidence=0,
                    key_risk="Agent error — treat this domain as unvalidated.",
                    clarifying_question="",
                )
            await queue.put(result)

        tasks = [asyncio.create_task(run_and_enqueue(spec)) for spec in AGENTS]

        all_results = []
        for _ in range(len(AGENTS)):
            result = await queue.get()
            all_results.append(result)
            yield f"data: {json.dumps({'type': 'agent', 'agent': result.model_dump()})}\n\n"

        await asyncio.gather(*tasks)
        pd = pending_domains(all_results, [])
        yield f"data: {json.dumps({'type': 'done', 'pending_domains': pd})}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
