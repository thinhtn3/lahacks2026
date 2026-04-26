import { AgentId, AgentSource, FinalReport } from "./venture-types";
import { AgentTurn } from "./venture-engine";

// ── Backend shapes ────────────────────────────────────────────────────────────

export type BackendDomain =
  | "problem_user"
  | "market_competition"
  | "business_distribution"
  | "tech_product";

export interface BackendSource {
  title: string;
  url: string;
}

export interface BackendAgentResult {
  domain: BackendDomain;
  name: string;
  insights: string[];
  confidence: number;
  key_risk: string;
  clarifying_question: string;
  sources: BackendSource[];
}

// ── Mappings ──────────────────────────────────────────────────────────────────

export const DOMAIN_TO_AGENT: Record<BackendDomain, AgentId> = {
  problem_user: "problem",
  market_competition: "market",
  business_distribution: "business",
  tech_product: "tech",
};

export const AGENT_TO_DOMAIN: Record<AgentId, BackendDomain> = {
  problem: "problem_user",
  market: "market_competition",
  business: "business_distribution",
  tech: "tech_product",
};

// ── Converters ────────────────────────────────────────────────────────────────

function toAgentSources(sources: BackendSource[]): AgentSource[] {
  return sources.map((s) => ({ type: "market" as const, label: s.title, summary: s.url }));
}

export function agentResultToTurns(result: BackendAgentResult): AgentTurn[] {
  const agentId = DOMAIN_TO_AGENT[result.domain];
  const lines = [...result.insights];
  if (result.key_risk) lines.push(`Risk: ${result.key_risk}`);
  return [{
    agentId,
    text: lines.join("\n\n"),
    setScore: { [agentId]: result.confidence } as Partial<Record<AgentId, number>>,
  }];
}

// ── streamAnalysis ────────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onTurn: (turn: AgentTurn) => void;
  onSources: (agentId: AgentId, sources: AgentSource[]) => void;
  onDone: (agents: BackendAgentResult[]) => void;
  onError: (err: Error) => void;
}

export interface BackendClarifyingQA {
  domain: BackendDomain;
  question: string;
  answer: string;
}

export interface BackendClarifyResponse {
  agents: BackendAgentResult[];
  pending_domains: BackendDomain[];
  history: BackendClarifyingQA[];
}

export async function submitClarify(
  idea: string,
  agents: BackendAgentResult[],
  history: BackendClarifyingQA[],
  domain: BackendDomain,
  question: string,
  answer: string,
): Promise<BackendClarifyResponse> {
  const API = import.meta.env.VITE_API_URL ?? "";
  const res = await fetch(`${API}/api/clarify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, agents, history, domain, question, answer }),
  });
  if (!res.ok) throw new Error(`Clarify error: ${res.status}`);
  return res.json();
}

export async function fetchVerdict(
  idea: string,
  agents: BackendAgentResult[],
  history: BackendClarifyingQA[],
): Promise<FinalReport> {
  const API = import.meta.env.VITE_API_URL ?? "";
  const res = await fetch(`${API}/api/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, agents, history }),
  });
  if (!res.ok) throw new Error(`Verdict error: ${res.status}`);
  const data = await res.json();
  return {
    overallScore: data.confidence_score,
    takeaway: data.takeaway,
    summary: data.summary,
    strengths: data.strengths,
    risks: data.top_risks,
    insight: data.insight,
    strengthen: data.strengthen,
    nextSteps: data.next_steps,
  };
}

export async function streamAnalysis(idea: string, cb: StreamCallbacks): Promise<void> {
  const API = import.meta.env.VITE_API_URL ?? "";
  const collected: BackendAgentResult[] = [];

  cb.onTurn({ agentId: "orchestrator", text: "Panel convened. Routing to specialists." });

  let res: Response;
  try {
    res = await fetch(`${API}/api/analyze/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
  } catch (e) {
    cb.onError(e instanceof Error ? e : new Error(String(e)));
    return;
  }

  if (!res.ok) {
    cb.onError(new Error(`Server error: ${res.status}`));
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6));

      if (data.type === "agent") {
        const result: BackendAgentResult = data.agent;
        collected.push(result);
        for (const turn of agentResultToTurns(result)) cb.onTurn(turn);
        cb.onSources(DOMAIN_TO_AGENT[result.domain], toAgentSources(result.sources));
      } else if (data.type === "done") {
        const market = collected.find((a) => a.domain === "market_competition");
        const business = collected.find((a) => a.domain === "business_distribution");
        if (market && business && Math.abs(market.confidence - business.confidence) > 12) {
          cb.onTurn({
            agentId: "orchestrator",
            text: "Tension between market opportunity and monetization path.",
            conflictWith: ["market", "business"],
          });
        }
        cb.onTurn({ agentId: "orchestrator", text: "Converging on a verdict.", resolveConflicts: true });
        cb.onDone(collected);
      }
    }
  }
}
