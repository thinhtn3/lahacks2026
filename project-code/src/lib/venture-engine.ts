import { AgentId, AgentSource, ChatMessage, FinalReport, IdeaInput } from "./venture-types";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: T[], seed: number) { return arr[seed % arr.length]; }

export function readinessScore(input: Partial<IdeaInput>): number {
  const fields: (keyof IdeaInput)[] = ["pitch", "targetUser", "problem", "alternatives", "businessModel", "technical", "industry"];
  const weights = { pitch: 22, targetUser: 18, problem: 22, alternatives: 14, businessModel: 8, technical: 8, industry: 8 } as Record<string, number>;
  let total = 0;
  for (const f of fields) {
    const v = (input[f] || "").toString().trim();
    if (!v) continue;
    const len = Math.min(v.length, 120) / 120;
    total += weights[f] * (0.5 + 0.5 * len);
  }
  return Math.round(total);
}

function id() { return Math.random().toString(36).slice(2, 10); }

export interface AgentTurn {
  agentId: AgentId | "orchestrator";
  text: string;
  scoreDelta?: Partial<Record<AgentId, number>>;
  setScore?: Partial<Record<AgentId, number>>;
  /** Mark these agent pairs as in conflict. */
  conflictWith?: AgentId[];
  /** Clear all current conflicts. */
  resolveConflicts?: boolean;
}

/** Dynamic scanning label per agent (used during analysis state). */
export const SCANNING_LABEL: Record<AgentId, string> = {
  problem:  "Scanning user behavior",
  market:   "Scanning competitors",
  business: "Scanning market signals",
  tech:     "Scanning technical landscape",
};

/** Build plausible-looking sources per agent based on the brief. */
export function buildSources(input: Partial<IdeaInput>): Record<AgentId, AgentSource[]> {
  const industry = (input.industry || "").trim();
  const alt = (input.alternatives || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const user = (input.targetUser || "users").trim();

  const competitor1 = alt[0] || (industry ? `${industry} incumbents` : "Notion AI");
  const competitor2 = alt[1] || "ChatGPT";
  const marketSignal = industry ? `${industry} adoption trends` : "AI productivity tools";

  return {
    problem: [
      { type: "user", label: `User segment: ${user}`, summary: "Pain point recurs in qualitative interviews and forum threads." },
      { type: "user", label: "Behavior signal: workflow friction", summary: "Users improvise with spreadsheets and ad-hoc scripts to cope." },
      { type: "market", label: "Search interest", summary: "Query volume around the problem is steady, not viral." },
    ],
    market: [
      { type: "competitor", label: `Competitor checked: ${competitor1}`, summary: "Adjacent solution — broad horizontal play, weak on this niche." },
      { type: "competitor", label: `Competitor checked: ${competitor2}`, summary: "Generalist tool; users substitute it but with friction." },
      { type: "market", label: `Market signal: ${marketSignal}`, summary: "Category is growing but increasingly crowded at the top." },
    ],
    business: [
      { type: "market", label: "Pricing benchmarks", summary: `Comparable tools price between $15–$45/seat/month.` },
      { type: "market", label: "Distribution channels", summary: "Direct + community-led tend to outperform paid ads in this space." },
      { type: "competitor", label: "Monetization patterns", summary: "Freemium with team upsell is the dominant model." },
    ],
    tech: [
      { type: "tech", label: "Stack feasibility", summary: "Standard web stack covers core needs; no exotic infra required." },
      { type: "tech", label: "Model availability", summary: "Capable foundation models are accessible via gateway APIs." },
      { type: "market", label: "Build vs. buy", summary: "Most non-core components can be assembled from existing services." },
    ],
  };
}

export function buildPanelScript(input: IdeaInput): AgentTurn[] {
  const seed = hash((input.pitch || "") + (input.problem || "") + (input.targetUser || ""));
  const name = input.startupName?.trim() || "the company";
  const user = input.targetUser?.trim() || "the target users";

  const base = {
    problem:  55 + ((seed >> 1) % 25) + ((input.problem?.length ?? 0) > 60 ? 5 : 0),
    market:   50 + ((seed >> 3) % 30) + ((input.alternatives?.length ?? 0) > 40 ? 5 : 0),
    business: 45 + ((seed >> 5) % 30) + (input.businessModel ? 10 : -5),
    tech:     55 + ((seed >> 7) % 25) + (input.technical ? 8 : 0),
  };

  // Detect a likely conflict: market is bullish-ish, business is bearish (or vice versa)
  const conflict = Math.abs(base.market - base.business) > 12;

  return [
    { agentId: "orchestrator", text: `Panel convened on ${name}. Routing to specialists.` },
    {
      agentId: "problem",
      text: `${user} clearly feel the pain — but is this top-3 priority for them, or just a nice-to-have?`,
      setScore: { problem: base.problem },
    },
    {
      agentId: "market",
      text: pick([
        `Existing alternatives suggest a real category. Question is wedge vs. incumbents.`,
        `Crowded space. Differentiation has to be sharp, not incremental.`,
        `Adjacent solutions exist but leave room — timing looks reasonable.`,
      ], seed),
      setScore: { market: base.market },
      scoreDelta: { problem: 2 },
    },
    {
      agentId: "business",
      text: input.businessModel
        ? `Monetization is plausible. CAC and willingness-to-pay are the real unknowns.`
        : `No business model stated. That's a yellow flag — how does ${name} make money?`,
      setScore: { business: base.business },
      conflictWith: conflict ? ["market", "business"] : undefined,
    },
    {
      agentId: "tech",
      text: input.technical
        ? `Technical approach is coherent. Execution risk is moderate, not blocking.`
        : `Feasibility looks fine in principle, but the build path isn't articulated.`,
      setScore: { tech: base.tech },
    },
    {
      agentId: "orchestrator",
      text: conflict
        ? `Tension between market opportunity and monetization path. Pressure-testing both.`
        : `Cross-checking: differentiation and monetization need pressure-testing.`,
      scoreDelta: { market: -2, business: -1 },
    },
    {
      agentId: "orchestrator",
      text: `Converging on a verdict.`,
      resolveConflicts: true,
    },
  ];
}

export function buildClarification(input: IdeaInput): { agentId: AgentId; question: string } {
  if (!input.businessModel) {
    return { agentId: "business", question: "How will you monetize, and what's a realistic price point?" };
  }
  return { agentId: "market", question: "What's your single sharpest differentiator vs. existing alternatives?" };
}

export function buildReevaluation(answer: string, target: AgentId): AgentTurn[] {
  const strong = answer.trim().length > 40;
  const delta = strong ? 8 : 3;
  const second: AgentId = target === "business" ? "market" : "business";
  return [
    { agentId: "orchestrator", text: `Updating evaluation with new context.`, resolveConflicts: true },
    {
      agentId: target,
      text: strong
        ? `Useful clarification — that materially de-risks my concern.`
        : `Noted. Helps a little, but still want more specifics.`,
      scoreDelta: { [target]: delta } as Partial<Record<AgentId, number>>,
    },
    {
      agentId: second,
      text: strong
        ? `Knock-on positive: this strengthens the broader thesis too.`
        : `My read is mostly unchanged.`,
      scoreDelta: { [second]: strong ? 3 : 1 } as Partial<Record<AgentId, number>>,
    },
  ];
}

export function buildFinalReport(input: IdeaInput, scores: Record<AgentId, number>): FinalReport {
  const overall = Math.round((scores.problem + scores.market + scores.business + scores.tech) / 4);
  const name = input.startupName?.trim() || "The idea";
  const alt = (input.alternatives || "").split(/[,;]/)[0]?.trim() || "existing tools";
  const targetUser = input.targetUser || "users";
  const takeaway = overall >= 75
    ? `${name} addresses a real problem with a credible approach. Sharpening differentiation and proving early traction would make it noticeably stronger.`
    : overall >= 55
      ? `This idea addresses a real problem, but could be stronger with clearer differentiation and a more concrete path to early users.`
      : `There's a kernel of a real problem here. The idea would benefit from a narrower focus and clearer evidence that ${targetUser} actively want this.`;

  return {
    overallScore: overall,
    takeaway,
    summary: `${name} targets ${targetUser} with a clear problem framing. Panel sees genuine signal in user pain, with execution and differentiation as the main open questions.`,
    strengths: [
      "Specific, identifiable user with real pain",
      "Plausible technical path",
      input.businessModel ? "Articulated monetization angle" : "Tight, focused problem statement",
    ],
    risks: [
      "Differentiation vs. existing alternatives needs sharpening",
      input.businessModel ? "Pricing & CAC unproven" : "Business model undefined",
      "Distribution strategy not yet validated",
    ],
    insight: `The wedge isn't the feature set — it's how ${name} earns the first 100 obsessed users before competitors notice.`,
    strengthen: [
      `One opportunity is to focus on a narrower user segment to build stronger early traction.`,
      `Emphasize a workflow or angle that ${alt} doesn't support well today.`,
      `Refine positioning so the value is clear in a single sentence.`,
    ],
    nextSteps: [
      `Talk to 5–10 ${targetUser} this week to validate the problem is top-3 for them`,
      `Test whether users actually prefer this over ${alt}`,
      `Build a simple MVP focused only on the single core moment of value`,
      `Clarify in one sentence how this is meaningfully different from ${alt}`,
      input.businessModel ? `Pressure-test pricing with 3 willingness-to-pay conversations` : `Sketch a first monetization hypothesis to test`,
    ],
  };
}

export function makeMessage(turn: AgentTurn): ChatMessage {
  return { id: id(), agentId: turn.agentId, text: turn.text, timestamp: Date.now() };
}
