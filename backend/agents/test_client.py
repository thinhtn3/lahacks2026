"""
Test client — sends a ChatMessage directly to the orchestrator to verify it's receiving messages.
Run from backend/ in a separate terminal while all 5 agents are running:

    python -m agents.test_client
"""
from datetime import datetime
from uuid import uuid4

from dotenv import load_dotenv
load_dotenv()

from uagents import Agent, Context
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    TextContent,
)

# Your orchestrator's address (printed at orchestrator startup)
ORCHESTRATOR_ADDRESS = "agent1qf64trcndfsynn0epjr82jmlfz6ez0t0ww0rusqr80garqt4m9kfwzzd05d"

agent = Agent(
    name="test-client",
    seed="test-client-lahacks-2026",
    port=8006,
    endpoint=["http://127.0.0.1:8006/submit"],
)


@agent.on_event("startup")
async def send_message(ctx: Context) -> None:
    ctx.logger.info("Sending test message to orchestrator...")
    await ctx.send(ORCHESTRATOR_ADDRESS, ChatMessage(
        timestamp=datetime.now(),
        msg_id=uuid4(),
        content=[TextContent(type="text", text="An app that helps college students find scholarships using AI")],
    ))


@agent.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement) -> None:
    ctx.logger.info("Got acknowledgement from orchestrator ✅ — waiting for analysis...")


@agent.on_message(ChatMessage)
async def handle_response(ctx: Context, sender: str, msg: ChatMessage) -> None:
    text = " ".join(item.text for item in msg.content if isinstance(item, TextContent))
    ctx.logger.info("\n---\n%s\n---", text)


agent.run()
