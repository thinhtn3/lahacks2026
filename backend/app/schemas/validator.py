from typing import Literal, Optional
from pydantic import BaseModel


class AgentResult(BaseModel):
    name: Literal["Problem Validator", "Market Analyst", "Risk Analyst"]
    insights: list[str]
    confidence: int
    key_risk: str


class ConflictResult(BaseModel):
    has_conflict: bool
    conflict_summary: Optional[str] = None


class AnalyzeRequest(BaseModel):
    idea: str


class AnalyzeResponse(BaseModel):
    agents: list[AgentResult]
    conflict: ConflictResult
    clarifying_question: Optional[str] = None  # set only when conflict.has_conflict=True


class VerdictRequest(BaseModel):
    idea: str
    prior_agents: list[AgentResult]
    clarifying_question: Optional[str] = None
    clarifying_answer: Optional[str] = None


class VerdictResponse(BaseModel):
    agents: list[AgentResult]
    verdict: Literal["Invest", "Pass", "Needs Work"]
    top_risks: list[str]
    suggestions: list[str]
