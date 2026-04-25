from fastapi import APIRouter, HTTPException
from app.schemas.agent import AnalyzeRequest, MarketAnalystResponse
from app.services.market_analyst import analyze_market

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/market-analyst", response_model=MarketAnalystResponse)
async def market_analyst(request: AnalyzeRequest):
    try:
        result = await analyze_market(request.prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
