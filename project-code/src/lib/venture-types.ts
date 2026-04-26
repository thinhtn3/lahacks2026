export type AgentId = "problem" | "market" | "business" | "tech";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  short: string;
  note: string;
  colorVar: string; // tailwind color class fragment, e.g. "agent-1"
  hslVar: string;   // CSS var name e.g. "--agent-1"
}

export interface IdeaInput {
  startupName?: string;
  industry?: string;
  pitch?: string;
  targetUser?: string;
  problem?: string;
  alternatives?: string;
  businessModel?: string;
  technical?: string;
}

export type AgentStatus = "idle" | "initializing" | "analyzing" | "spoken" | "updating";

export interface AgentSource {
  type: "competitor" | "market" | "user" | "tech";
  label: string;
  summary: string;
}

export interface AgentState {
  status: AgentStatus;
  score: number | null;
  /** Live confidence 0-100; fluctuates during analysis, settles to score. */
  confidence: number;
  /** Whether this agent is currently in conflict with another. */
  conflict?: boolean;
  /** Sources gathered by the agent. */
  sources: AgentSource[];
}

export interface ChatMessage {
  id: string;
  agentId: AgentId | "orchestrator" | "user";
  text: string;
  timestamp: number;
}

export interface ClarificationRequest {
  id: string;
  agentId: AgentId;
  question: string;
}

export interface FinalReport {
  overallScore: number;
  takeaway: string;
  summary: string;
  strengths: string[];
  risks: string[];
  insight: string;
  strengthen: string[];
  nextSteps: string[];
}

export const AGENTS: Agent[] = [
  { id: "problem",  name: "Problem & User",          role: "Problem & User",          short: "P&U", note: "Listens for the ache underneath the pitch.",  colorVar: "agent-1", hslVar: "--agent-1" },
  { id: "market",   name: "Market & Competition",    role: "Market & Competition",    short: "M&C", note: "Maps the terrain where the idea must live.",   colorVar: "agent-2", hslVar: "--agent-2" },
  { id: "business", name: "Business & Distribution", role: "Business & Distribution", short: "B&D", note: "Follows the quiet path of the money.",         colorVar: "agent-3", hslVar: "--agent-3" },
  { id: "tech",     name: "Technical Feasibility",   role: "Technical Feasibility",   short: "TF",  note: "Tests what holds when the load arrives.",      colorVar: "agent-4", hslVar: "--agent-4" },
];