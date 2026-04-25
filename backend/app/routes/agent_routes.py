from fastapi import APIRouter, HTTPException
from app.schemas.validator import AnalyzeRequest, AgentResult
from app.services.market_analyst import analyze_market

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/market-analyst", response_model=AgentResult)
async def market_analyst_route(request: AnalyzeRequest):
    try:
        return await analyze_market(request.idea)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
