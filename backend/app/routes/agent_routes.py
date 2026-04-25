import logging
import traceback
from fastapi import APIRouter, HTTPException
from app.schemas.agent import AnalyzeRequest, AgentResponse
from app.services.market_analyst import analyze_market
from app.services.problem_validator import validate_problem
from app.services.risk_analyst import analyze_risk

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/market-analyst", response_model=AgentResponse)
async def market_analyst(request: AnalyzeRequest):
    try:
        return await analyze_market(request.prompt)
    except Exception as e:
        logger.error("market-analyst error:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/problem-validator", response_model=AgentResponse)
async def problem_validator(request: AnalyzeRequest):
    try:
        return await validate_problem(request.prompt)
    except Exception as e:
        logger.error("problem-validator error:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/risk-analyst", response_model=AgentResponse)
async def risk_analyst(request: AnalyzeRequest):
    try:
        return await analyze_risk(request.prompt)
    except Exception as e:
        logger.error("risk-analyst error:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
