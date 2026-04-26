"""
Startup Validator Orchestrator — port 8005
ASI:One-facing agent with live per-agent updates and targeted routing.

Targeted routing keywords:
  @problem       → Problem Validator only
  @market        → Market Analyst only
  @tech          → Tech Feasibility only
  @monetization  → Monetization Expert only
  (no keyword)   → all 4 agents in parallel

Run from backend/:
    python -m agents.orchestrator
"""
import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from dotenv import load_dotenv
load_dotenv()

from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    TextContent,
    chat_protocol_spec,
)

from agents.config import (
    MARKET_ADDRESS,
    MONETIZATION_ADDRESS,
    ORCHESTRATOR_SEED,
    PROBLEM_ADDRESS,
    TECH_ADDRESS,
)
from agents.models import AgentResult, AgentTask

TIMEOUT_SECONDS = 60

_DOMAIN_META = {
    "problem_user":          {"label": "Problem Validator",   "emoji": "🔍"},
    "market_competition":    {"label": "Market Analyst",      "emoji": "📊"},
    "business_distribution": {"label": "Monetization Expert", "emoji": "💰"},
    "tech_product":          {"label": "Tech Feasibility",    "emoji": "⚙️"},
}

_TARGETED_KEYWORDS = {
    "problem_user":          ["#problem", "problem only", "just problem", "problem severity only"],
    "market_competition":    ["#market", "market only", "just market", "market analysis only"],
    "business_distribution": ["#monetization", "monetization only", "just monetization", "business model only"],
    "tech_product":          ["#tech", "tech only", "just tech", "technical feasibility only"],
}

_ALL_DOMAINS = list(_DOMAIN_META.keys())

chat_proto = Protocol(spec=chat_protocol_spec)

orchestrator = Agent(
    name="startup-validator-orchestrator",
    seed=ORCHESTRATOR_SEED,
    port=8005,
    mailbox=True,
    publish_agent_details=True,
)

_sessions: dict[str, dict] = {}


def _get_address(domain: str) -> str:
    return {
        "problem_user": PROBLEM_ADDRESS,
        "market_competition": MARKET_ADDRESS,
        "business_distribution": MONETIZATION_ADDRESS,
        "tech_product": TECH_ADDRESS,
    }[domain]


def _detect_target(query: str) -> str | None:
    lower = query.lower()
    for domain, keywords in _TARGETED_KEYWORDS.items():
        if any(k in lower for k in keywords):
            return domain
    return None


def _verdict(avg: int) -> str:
    if avg >= 65:
        return "Invest ✅"
    if avg >= 40:
        return "Needs Work ⚠️"
    return "Pass ❌"


async def _send_update(ctx: Context, addr: str, text: str) -> None:
    await ctx.send(addr, ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[TextContent(type="text", text=text)],
    ))


async def _send_final(ctx: Context, addr: str, text: str) -> None:
    await ctx.send(addr, ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[TextContent(type="text", text=text)],
    ))


async def _finish_session(ctx: Context, session: dict, session_id: str) -> None:
    confidences = session["confidences"]
    results = session["results"]
    expected = session["expected"]
    user_addr = session["user_addr"]

    if len(expected) == 1:
        domain = expected[0]
        await _send_final(ctx, user_addr, results.get(domain, "*No response*"))
    else:
        sections = []
        for domain in _ALL_DOMAINS:
            if domain in results:
                sections.append(results[domain])

        avg = int(sum(confidences.values()) / len(confidences)) if confidences else 0
        best = max(confidences, key=confidences.get, default="—")
        worst = min(confidences, key=confidences.get, default="—")
        verdict_block = (
            f"📋 **Final Verdict: {_verdict(avg)}**\n\n"
            f"Average confidence: {avg}/100\n\n"
            f"Strongest: {_DOMAIN_META.get(best, {}).get('emoji', '')} {_DOMAIN_META.get(best, {}).get('label', best)}\n\n"
            f"Needs work: {_DOMAIN_META.get(worst, {}).get('emoji', '')} {_DOMAIN_META.get(worst, {}).get('label', worst)}"
        )
        sections.append(verdict_block)
        await _send_final(ctx, user_addr, "\n\n---\n\n".join(sections))

    _sessions.pop(session_id, None)


async def _timeout(ctx: Context, session_id: str) -> None:
    await asyncio.sleep(TIMEOUT_SECONDS)
    session = _sessions.get(session_id)
    if session is None:
        return
    ctx.logger.warning("Timeout for session %s", session_id[:8])
    if session["results"]:
        await _finish_session(ctx, session, session_id)
    else:
        await _send_final(ctx, session["user_addr"],
            "⏱️ Analysis timed out — agents did not respond. Please try again.")
        _sessions.pop(session_id, None)


@orchestrator.on_event("startup")
async def on_startup(ctx: Context) -> None:
    ctx.logger.info("Orchestrator : %s", orchestrator.address)
    ctx.logger.info("Problem      : %s", PROBLEM_ADDRESS)
    ctx.logger.info("Market       : %s", MARKET_ADDRESS)
    ctx.logger.info("Monetization : %s", MONETIZATION_ADDRESS)
    ctx.logger.info("Tech         : %s", TECH_ADDRESS)


@chat_proto.on_message(ChatMessage)
async def handle_chat(ctx: Context, sender: str, msg: ChatMessage) -> None:
    await ctx.send(sender, ChatAcknowledgement(
        timestamp=datetime.now(timezone.utc),
        acknowledged_msg_id=msg.msg_id,
    ))

    query = " ".join(
        item.text for item in msg.content if isinstance(item, TextContent)
    ).strip()
    if not query:
        return

    _HELP = (
        "👋 **Startup Validator** — powered by 4 specialist AI agents running in parallel.\n\n"
        "**How to use:**\n\n"
        "• Describe your startup idea → all 4 agents analyze it simultaneously\n\n"
        "• Add a tag to query one specialist:\n\n"
        "  `#problem` → 🔍 Problem Validator\n\n"
        "  `#market` → 📊 Market Analyst\n\n"
        "  `#monetization` → 💰 Monetization Expert\n\n"
        "  `#tech` → ⚙️ Tech Feasibility\n\n"
        "**Example:** `An AI pitch coach for founders #market`\n\n"
        "Ready — describe your startup idea to get started."
    )

    # Show help for very short or greeting-style messages
    greetings = {"hi", "hello", "hey", "help", "start", "?", "what", "who are you", "how"}
    if len(query.split()) <= 3 and query.lower().strip("?!. ") in greetings or query.lower() in {"help", "?"}:
        await _send_final(ctx, sender, _HELP)
        return

    session_id = str(msg.msg_id)
    target = _detect_target(query)
    expected = [target] if target else _ALL_DOMAINS

    timer = asyncio.create_task(_timeout(ctx, session_id))
    _sessions[session_id] = {
        "user_addr": sender,
        "results": {},
        "confidences": {},
        "expected": expected,
        "timer": timer,
    }

    if target:
        meta = _DOMAIN_META[target]
        await _send_update(ctx, sender,
            f"{meta['emoji']} Routing to **{meta['label']}** only...\n\n"
            f"_(Use #problem / #market / #tech / #monetization to target any specialist)_")
        await ctx.send(_get_address(target), AgentTask(
            chat_session_id=session_id,
            query=query,
            user_sender_address=sender,
            domain=target,
        ))
    else:
        agent_list = "\n\n".join(
            f"  • {m['emoji']} {m['label']}" for m in _DOMAIN_META.values()
        )
        await _send_update(ctx, sender,
            f"🚀 Dispatching to 4 specialist agents in parallel...\n\n{agent_list}\n\n"
            f"_(Tip: add #problem, #market, #tech, or #monetization to query a single specialist)_")
        for domain in _ALL_DOMAINS:
            await ctx.send(_get_address(domain), AgentTask(
                chat_session_id=session_id,
                query=query,
                user_sender_address=sender,
                domain=domain,
            ))


@chat_proto.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement) -> None:
    pass


@orchestrator.on_message(AgentResult)
async def handle_result(ctx: Context, sender: str, result: AgentResult) -> None:
    session = _sessions.get(result.chat_session_id)
    if session is None:
        return

    session["results"][result.domain] = result.result
    session["confidences"][result.domain] = result.confidence

    arrived = len(session["results"])
    total = len(session["expected"])
    ctx.logger.info("Result %d/%d: %s", arrived, total, result.domain)

    if arrived >= total:
        session["timer"].cancel()
        await _finish_session(ctx, session, result.chat_session_id)


orchestrator.include(chat_proto, publish_manifest=True)

if __name__ == "__main__":
    orchestrator.run()
