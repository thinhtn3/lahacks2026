from typing import Literal
from pydantic import BaseModel


class AgentResult(BaseModel):
    name: Literal["Problem Validator", "Market Analyst", "Risk Analyst"]
    insights: list[str]
    confidence: int
    key_risk: str


class AnalyzeRequest(BaseModel):
    idea: str


class AnalyzeResponse(BaseModel):
    agents: list[AgentResult]
    clarifying_question: str


class VerdictRequest(BaseModel):
    idea: str
    prior_agents: list[AgentResult]
    clarifying_question: str
    clarifying_answer: str


class VerdictResponse(BaseModel):
    agents: list[AgentResult]
    verdict: Literal["Invest", "Pass", "Needs Work"]
    top_risks: list[str]
    suggestions: list[str]
