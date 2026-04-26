import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, AlertTriangle, Globe } from "lucide-react";
import { AGENTS, AgentId, AgentSource, AgentState } from "@/lib/venture-types";
import { SCANNING_LABEL } from "@/lib/venture-engine";
import { cn } from "@/lib/utils";

interface Props {
  agentStates: Record<AgentId, AgentState>;
  activeAgent: AgentId | "orchestrator" | null;
  insights: Partial<Record<AgentId, string>>;
  /** Per-agent ready sources (revealed after analysis). */
  sourcesByAgent: Record<AgentId, AgentSource[]>;
  /** 0-100 — fills the Lead Investor ring. */
  centralConfidence: number;
  /** When true, ring renders in green (verdict reached). */
  centralResolved: boolean;
  /** Pairs of agents currently in conflict. */
  conflicts: Array<[AgentId, AgentId]>;
  appearedAt: number;
}

const ease = [0.22, 1, 0.36, 1] as const;

const QUADRANTS: Record<AgentId, "top-left" | "top-right" | "bottom-left" | "bottom-right"> = {
  problem:  "top-left",
  market:   "top-right",
  tech:     "bottom-left",
  business: "bottom-right",
};

const NODE_COORDS: Record<AgentId, { x: number; y: number }> = {
  problem:  { x: 14, y: 14 },
  market:   { x: 86, y: 14 },
  tech:     { x: 14, y: 66 },
  business: { x: 86, y: 66 },
};

export const AgentDiagram = ({
  agentStates,
  activeAgent,
  insights,
  sourcesByAgent,
  centralConfidence,
  centralResolved,
  conflicts,
}: Props) => {
  const isConflictPair = (a: AgentId, b: AgentId) =>
    conflicts.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  return (
    <div className="relative w-full h-full">
      <div className="relative mx-auto w-full h-full max-w-[1100px]">
        {/* Connection lines (SVG) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 80"
          preserveAspectRatio="none"
        >
          {(["problem", "market", "business", "tech"] as AgentId[]).map((aid, i) => {
            const c = NODE_COORDS[aid];
            // Conflict if this agent is in any conflict pair.
            const inConflict = conflicts.some(([x, y]) => x === aid || y === aid);
            return (
              <motion.line
                key={aid}
                x1={50}
                y1={40}
                x2={c.x}
                y2={c.y}
                stroke={inConflict ? "hsl(var(--destructive))" : "hsl(var(--border))"}
                strokeWidth={inConflict ? "0.45" : "0.15"}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: inConflict ? [0.55, 0.95, 0.55] : 1,
                }}
                transition={{
                  pathLength: { duration: 1.2, delay: 0.9 + i * 0.15, ease },
                  opacity: inConflict
                    ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.8, ease },
                }}
              />
            );
          })}
        </svg>

        {/* Conflict warning icons floating along red lines */}
        {(["problem", "market", "business", "tech"] as AgentId[]).map((aid) => {
          const inConflict = conflicts.some(([x, y]) => x === aid || y === aid);
          if (!inConflict) return null;
          const c = NODE_COORDS[aid];
          // Mid-point between center (50,40) and node, expressed as % of container.
          const mx = (50 + c.x) / 2;
          const my = (40 + c.y) / 2;
          return (
            <motion.div
              key={`warn-${aid}`}
              className="absolute z-30 pointer-events-none"
              style={{
                left: `${mx}%`,
                top: `${(my / 80) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease }}
            >
              <div className="flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 shadow-soft border border-destructive/30">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                <span className="text-[9px] uppercase tracking-[0.18em] text-destructive/90">Conflict</span>
              </div>
            </motion.div>
          );
        })}

        {/* Outer: fixed centering. Inner motion: scale only (avoids Framer overwriting translate). */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
            className="origin-center"
          >
            <CentralRing confidence={centralConfidence} resolved={centralResolved} active={activeAgent === "orchestrator"} />
          </motion.div>
        </div>

        {/* Agent nodes */}
        {AGENTS.map((agent, i) => {
          const pos = QUADRANTS[agent.id];
          const positionClasses = {
            "top-left":     "left-0 top-0",
            "top-right":    "right-0 top-0",
            "bottom-left":  "left-0 bottom-0",
            "bottom-right": "right-0 bottom-0",
          }[pos];
          const state = agentStates[agent.id];
          const insight = insights[agent.id];
          const active = activeAgent === agent.id;
          const inConflict = state.conflict || conflicts.some(([x, y]) => x === agent.id || y === agent.id);
          const sources = sourcesByAgent[agent.id] || [];

          return (
            <motion.div
              key={agent.id}
              className={cn("absolute w-[24%] z-20", positionClasses)}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: active ? 1.02 : 1 }}
              transition={{
                opacity: { duration: 0.8, delay: 0.4 + i * 0.18, ease },
                y: { duration: 0.8, delay: 0.4 + i * 0.18, ease },
                scale: { duration: 0.6, ease },
              }}
            >
              <AgentCard
                agent={agent}
                state={state}
                insight={insight}
                active={active}
                inConflict={inConflict}
                sources={sources}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const statusLabel: Record<AgentState["status"], string> = {
  idle: "Standby",
  initializing: "Preparing",
  analyzing: "Analyzing",
  spoken: "Spoke",
  updating: "Reconsidering",
};

const AgentCard = ({
  agent,
  state,
  insight,
  active,
  inConflict,
  sources,
}: {
  agent: typeof AGENTS[number];
  state: AgentState;
  insight?: string;
  active?: boolean;
  inConflict?: boolean;
  sources: AgentSource[];
}) => {
  const isAnalyzing = state.status === "analyzing" || state.status === "initializing";
  const sourcesReady = !isAnalyzing && sources.length > 0;
  const confidence = Math.max(0, Math.min(100, Math.round(state.confidence)));

  return (
    <div className="relative">
      {/* Battery confidence bar above the card */}
      <ConfidenceBar
        value={confidence}
        conflict={!!inConflict}
        showLabel
      />

      <div
        className={cn(
          "relative mt-2 rounded-[18px] bg-card p-5 transition-all duration-700",
          active ? "shadow-card" : "shadow-soft",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
              {agent.role}
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60 mt-0.5">
              {statusLabel[state.status]}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={insight || "empty"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease }}
            className={cn(
              "mt-4 text-[13px] leading-relaxed font-light line-clamp-3",
              insight ? "text-foreground/85" : "text-muted-foreground/60 italic",
            )}
          >
            {insight ?? (isAnalyzing ? "Reading the brief…" : "Yet to speak.")}
          </motion.p>
        </AnimatePresence>

        {/* Sources */}
        <div className="mt-4 pt-3 border-t border-border/60">
          <SourcesPanel
            agentId={agent.id}
            sources={sources}
            ready={sourcesReady}
          />
        </div>
      </div>
    </div>
  );
};

/** Battery-style confidence bar with green/yellow states. */
const ConfidenceBar = ({
  value,
  conflict,
  showLabel,
}: {
  value: number;
  conflict?: boolean;
  showLabel?: boolean;
}) => {
  const color = conflict ? "hsl(var(--warning))" : "hsl(var(--success))";
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex-1 h-[3px] rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{
            width: `${Math.max(4, value)}%`,
            backgroundColor: color,
          }}
          transition={{
            width: { duration: 0.8, ease },
            backgroundColor: { duration: 0.6, ease },
          }}
        />
      </div>
      {showLabel && (
        <motion.span
          className="text-[9px] tabular-nums tracking-wider text-muted-foreground/80"
          animate={{ color: conflict ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))" }}
          transition={{ duration: 0.6 }}
        >
          CS: {Math.round(value)}%
        </motion.span>
      )}
    </div>
  );
};

/** Sources component — scanning text → expandable list. */
const SourcesPanel = ({
  agentId,
  sources,
  ready,
}: {
  agentId: AgentId;
  sources: AgentSource[];
  ready: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [scanIdx, setScanIdx] = useState(0);
  const baseLabel = SCANNING_LABEL[agentId];

  // Subtle dot animation through the scanning text.
  useEffect(() => {
    if (ready) return;
    const t = setInterval(() => setScanIdx((i) => (i + 1) % 3), 600);
    return () => clearInterval(t);
  }, [ready]);

  if (!ready) {
    const dots = ".".repeat(scanIdx + 1);
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 font-light">
        <Globe className="h-3 w-3 opacity-70" />
        <span>{baseLabel}{dots}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-300"
      >
        <Globe className="h-3 w-3 opacity-80" />
        <span>{sources.length} sources checked</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.4, ease }}
          className="inline-flex"
        >
          <ChevronDown className="h-3 w-3" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="sources"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.5, ease },
              opacity: { duration: 0.4, ease },
            }}
            className="overflow-hidden"
          >
            <ul className="mt-3 space-y-2.5">
              {sources.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease }}
                  className="text-[11px] leading-relaxed"
                >
                  <div className="text-foreground/85 font-medium">
                    {s.label}
                  </div>
                  <a
                    href={s.summary}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/80 font-light hover:text-foreground/70 transition-colors underline-offset-2 hover:underline"
                  >
                    {s.summary}
                  </a>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Central ring around the Lead Investor — yellow → green as confidence converges. */
const CentralRing = ({
  confidence,
  resolved,
  active,
}: {
  confidence: number;
  resolved: boolean;
  active?: boolean;
}) => {
  const size = 178;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, confidence));
  const offset = c - (pct / 100) * c;
  const color = resolved ? "hsl(var(--success))" : "hsl(var(--warning))";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset, stroke: color }}
          transition={{
            strokeDashoffset: { duration: 1.2, ease },
            stroke: { duration: 0.8, ease },
          }}
        />
      </svg>
      <div className="absolute inset-[14px] rounded-full bg-card shadow-soft flex flex-col items-center justify-center text-center">
        <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
          Lead Investor
        </div>
        <div className="font-display text-base mt-1.5 text-foreground italic">
          The Panel
        </div>
        <div className="text-[10px] tabular-nums mt-1.5 text-muted-foreground/80">
          {Math.round(pct)}%
        </div>
        {active && (
          <motion.div
            className="absolute inset-0 rounded-full ring-1 ring-foreground/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease }}
          />
        )}
      </div>
    </div>
  );
};
