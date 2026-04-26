from tavily import AsyncTavilyClient

from app.config import settings

_client: AsyncTavilyClient | None = None


def get_client() -> AsyncTavilyClient:
    global _client
    if _client is None:
        _client = AsyncTavilyClient(api_key=settings.tavily_api_key)
    return _client


def _format(results: list[dict], header: str) -> tuple[str, list[dict]]:
    if not results:
        return "", []
    lines = [f"{header}"]
    sources = []
    for r in results:
        lines.append(f"- {r['title']}: {r['content'][:300]}")
        sources.append({"title": r["title"], "url": r["url"]})
    return "\n".join(lines), sources


async def market_search(query: str) -> tuple[str, list[dict]]:
    try:
        response = await get_client().search(query=query, search_depth="advanced", max_results=5)
        return _format(response.get("results", []), "Market research (web):")
    except Exception:
        return "", []


async def deep_research(query: str) -> tuple[str, list[dict]]:
    try:
        response = await get_client().search(query=query, search_depth="advanced", max_results=10)
        return _format(response.get("results", []), "Competitor research (web):")
    except Exception:
        return "", []
