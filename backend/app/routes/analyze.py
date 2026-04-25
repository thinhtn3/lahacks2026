from fastapi import APIRouter, HTTPException
from app.schemas.validator import AnalyzeRequest, AnalyzeResponse
from app.services.agents import run_agents_parallel
from app.services.clarifier import generate_conflict_question
from app.services.conflict_detector import detect_conflicts

router = APIRouter(tags=["orchestrator"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    try:
        agents = await run_agents_parallel(request.idea)
        conflict = await detect_conflicts(request.idea, agents)

        clarifying_question = None
        if conflict.has_conflict:
            clarifying_question = await generate_conflict_question(
                request.idea, agents, conflict.conflict_summary
            )

        return AnalyzeResponse(agents=agents, conflict=conflict, clarifying_question=clarifying_question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
