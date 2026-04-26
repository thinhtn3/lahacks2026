from typing import Literal
from pydantic import BaseModel

AgentDomain = Literal[
    "problem_user",
    "market_competition",
    "business_distribution",
    "tech_product",
]


class ClarifyingQA(BaseModel):
    domain: AgentDomain
    question: str
    answer: str


class Source(BaseModel):
    title: str
    url: str


class AgentResult(BaseModel):
    domain: AgentDomain
    name: str
    insights: list[str]
    confidence: int
    key_risk: str
    clarifying_question: str
    sources: list[Source] = []


class AnalyzeRequest(BaseModel):
    idea: str


class AnalyzeResponse(BaseModel):
    agents: list[AgentResult]
    pending_domains: list[AgentDomain]


class ClarifyRequest(BaseModel):
    idea: str
    agents: list[AgentResult]
    history: list[ClarifyingQA]
    domain: AgentDomain
    question: str
    answer: str


class ClarifyResponse(BaseModel):
    agents: list[AgentResult]
    pending_domains: list[AgentDomain]
    history: list[ClarifyingQA]


class VerdictRequest(BaseModel):
    idea: str
    agents: list[AgentResult]
    history: list[ClarifyingQA]


class VerdictResponse(BaseModel):
    verdict: Literal["Invest", "Pass", "Needs Work"]
    confidence_score: int
    top_risks: list[str]
    suggestions: list[str]
    takeaway: str
    summary: str
    strengths: list[str]
    insight: str
    strengthen: list[str]
    next_steps: list[str]
