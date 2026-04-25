from fastapi import APIRouter, HTTPException
from app.schemas.validator import VerdictRequest, VerdictResponse
from app.services.agents import run_agents_parallel
from app.services.verdict import generate_verdict

router = APIRouter(tags=["orchestrator"])


@router.post("/verdict", response_model=VerdictResponse)
async def verdict(request: VerdictRequest):
    try:
        qa_block = ""
        if request.clarifying_question and request.clarifying_answer:
            qa_block = f"Q: {request.clarifying_question}\nA: {request.clarifying_answer}"

        agents = await run_agents_parallel(request.idea, clarifying_qa=qa_block)
        tail = await generate_verdict(request.idea, qa_block, agents)
        return VerdictResponse(agents=agents, **tail)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
