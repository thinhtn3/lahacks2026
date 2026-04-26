from app.schemas.validator import AgentDomain, AgentResult, ClarifyingQA
from app.services.agents import AGENTS

CONFIDENCE_THRESHOLD = 50

_DOMAIN_ORDER = [s.domain for s in AGENTS]


def pending_domains(agents: list[AgentResult], history: list[ClarifyingQA]) -> list[AgentDomain]:
    """Return domains with confidence < threshold that haven't been clarified yet.
    Each domain is allowed at most one clarifying question.
    Results sorted lowest→highest confidence; ties broken by canonical AGENTS list order."""
    already_clarified = {qa.domain for qa in history}
    low = [
        a for a in agents
        if a.confidence < CONFIDENCE_THRESHOLD and a.domain not in already_clarified
    ]
    low.sort(key=lambda a: (a.confidence, _DOMAIN_ORDER.index(a.domain)))
    return [a.domain for a in low]
