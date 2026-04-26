"""Monetization sub-agent — port 8003."""
from dotenv import load_dotenv
load_dotenv()

from uagents import Agent, Context

from agents.config import MONETIZATION_SEED
from agents.llm import call_llm_json
from agents.models import AgentResult, AgentTask
from app.services.prompts import build_system_prompt

agent = Agent(
    name="startup-monetization-analyst",
    seed=MONETIZATION_SEED,
    port=8003,
    mailbox=True,
    publish_agent_details=True,
)

_PROMPT = build_system_prompt("business_distribution")


@agent.on_message(AgentTask)
async def handle(ctx: Context, sender: str, task: AgentTask) -> None:
    ctx.logger.info("Monetization agent received: %s", task.query[:60])
    confidence = 0
    try:
        data = await call_llm_json(f"{_PROMPT}\n\nStartup idea: {task.query}")
        confidence = data.get("confidence", 0)
        bullets = "\n\n".join(f"• {i}" for i in data.get("insights", []))
        result = (
            f"**💰 Monetization Expert** (Confidence: {confidence}/100)\n\n"
            f"{bullets}\n\n"
            f"**Key Risk:** {data.get('key_risk', 'N/A')}"
        )
    except Exception as exc:
        result = f"**💰 Monetization Expert**: Analysis failed — {exc}"

    await ctx.send(sender, AgentResult(
        chat_session_id=task.chat_session_id,
        user_sender_address=task.user_sender_address,
        domain=task.domain,
        result=result,
        confidence=confidence,
    ))


if __name__ == "__main__":
    agent.run()
