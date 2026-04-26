from uagents import Model


class AgentTask(Model):
    """Orchestrator → sub-agent."""
    chat_session_id: str
    query: str
    user_sender_address: str
    domain: str


class AgentResult(Model):
    """Sub-agent → orchestrator."""
    chat_session_id: str
    user_sender_address: str
    domain: str
    result: str
    confidence: int = 0
