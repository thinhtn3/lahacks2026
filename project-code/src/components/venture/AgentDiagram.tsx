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

/** Match agent card motion (below): lines must not read “through” where the card is still invisible. */
const CARD_BASE_DELAY = 0.4;
const CARD_STAGGER = 0.18;
const CARD_IN_DURATION = 0.8;

const ALL_CARDS_IN_AT =
  CARD_BASE_DELAY + (AGENTS.length - 1) * CARD_STAGGER + CARD_IN_DURATION;
/** Wait until every card has landed, then hold — then start spokes in order. */
const LINES_PAUSE_AFTER_ALL_CARDS = 1.1;
const LINE_SPOKE_STAGGER = 0.14;

function lineEntranceDelay(agentIndex: number) {
  return ALL_CARDS_IN_AT + LINES_PAUSE_AFTER_ALL_CARDS + agentIndex * LINE_SPOKE_STAGGER;
}

const QUADRANTS: Record<AgentId, "top-left" | "top-right" | "bottom-left" | "bottom-right"> = {
  problem:  "top-left",
  market:   "top-right",
  tech:     "bottom-left",
  business: "bottom-right",
};

/** Hub & anchors in 0–100 viewBox (square; matches preserveAspectRatio stretch). */
const HUB = { x: 50, y: 50 } as const;

const NODE_COORDS: Record<AgentId, { x: number; y: number }> = {
  problem:  { x: 14, y: 17 },
  market:   { x: 86, y: 17 },
  tech:     { x: 14, y: 83 },
  business: { x: 86, y: 83 },
};

function connectorGeometry(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  bulge = 0.1,
) {
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const c1x = mx + (-dy / len) * (len * bulge);
  const c1y = my + (dx / len) * (len * bulge);
  return {
    d: `M ${sx} ${sy} Q ${c1x} ${c1y} ${ex} ${ey}`,
    control: { x: c1x, y: c1y },
  };
}

function quadPointAtT(
  t: number,
  sx: number,
  sy: number,
  c1x: number,
  c1y: number,
  ex: number,
  ey: number,
) {
  const u = 1 - t;
  return {
    x: u * u * sx + 2 * u * t * c1x + t * t * ex,
    y: u * u * sy + 2 * u * t * c1y + t * t * ey,
  };
}

export const AgentDiagram = ({
  agentStates,
  activeAgent,
  insights,
  sourcesByAgent,
  centralConfidence,
  centralResolved,
  conflicts,
}: Props) => {
  return (
    <div className="relative w-full h-full">
      <div className="relative mx-auto w-full h-full max-w-[1100px]">
        {/* Connection lines — square viewBox + curved paths (reads cleaner than diagonals when stretched) */}
        <svg
          className="absolute inset-0 z-0 h-full w-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            {(["problem", "market", "business", "tech"] as AgentId[]).map((aid) => {
              const t = NODE_COORDS[aid];
              return (
                <linearGradient
                  key={`g-${aid}`}
                  id={`spoke-gradient-${aid}`}
                  gradientUnits="userSpaceOnUse"
                  x1={HUB.x}
                  y1={HUB.y}
                  x2={t.x}
                  y2={t.y}
                >
                  <stop offset="0%" stopColor="hsl(var(--border))" stopOpacity={0.2} />
                  <stop offset="50%" stopColor="hsl(var(--border))" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="hsl(var(--border))" stopOpacity={0.8} />
                </linearGradient>
              );
            })}
          </defs>
          {(["problem", "market", "business", "tech"] as AgentId[]).map((aid, i) => {
            const t = NODE_COORDS[aid];
            const inConflict = conflicts.some(([x, y]) => x === aid || y === aid);
            const agent = AGENTS.find((a) => a.id === aid)!;
            const status = agentStates[aid].status;
            const isBusy = status === "analyzing" || status === "initializing" || status === "updating";
            const activeColor = `hsl(var(${agent.hslVar}))`;
            const d = `M ${HUB.x} ${HUB.y} L ${t.x} ${t.y}`;
            const strokeMain = inConflict
              ? "hsl(var(--destructive))"
              : isBusy
                ? activeColor
                : `url(#spoke-gradient-${aid})`;
            const strokeSoft = inConflict
              ? "hsl(var(--destructive))"
              : isBusy
                ? activeColor
                : "hsl(var(--border) / 0.25)";
            const wMain = inConflict ? 1.1 : isBusy ? 1.4 : 0.9;
            const wGlow = wMain * 2.2;
            return (
              <g key={aid}>
                {/* Glow layer */}
                <motion.path
                  d={d}
                  fill="none"
                  stroke={isBusy || inConflict ? strokeSoft : "hsl(var(--border))"}
                  strokeWidth={wGlow}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: inConflict ? 0.45 : isBusy ? 0.4 : 0.22 }}
                  transition={{ duration: 0.5, delay: lineEntranceDelay(i), ease }}
                />
                {/* Main line — only opacity animated, never pathLength */}
                <motion.path
                  d={d}
                  fill="none"
                  stroke={strokeMain}
                  strokeWidth={wMain}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: inConflict
                      ? [0.55, 0.95, 0.55]
                      : isBusy
                        ? [0.45, 0.95, 0.45]
                        : 0.9,
                  }}
                  transition={{
                    opacity: inConflict || isBusy
                      ? {
                          duration: 1.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: lineEntranceDelay(i) + 0.1,
                        }
                      : { duration: 0.55, delay: lineEntranceDelay(i), ease },
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Conflict warning icons floating along red lines */}
        {(["problem", "market", "business", "tech"] as AgentId[]).map((aid, lineIdx) => {
          const inConflict = conflicts.some(([x, y]) => x === aid || y === aid);
          if (!inConflict) return null;
          const c = NODE_COORDS[aid];
          const { control } = connectorGeometry(HUB.x, HUB.y, c.x, c.y, 0.1);
          const p = quadPointAtT(0.5, HUB.x, HUB.y, control.x, control.y, c.x, c.y);
          return (
            <motion.div
              key={`warn-${aid}`}
              className="absolute z-10 pointer-events-none"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: lineEntranceDelay(lineIdx) + 0.1, ease }}
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
              className={cn("absolute w-[42%] z-20", positionClasses)}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: active ? 1.02 : 1 }}
              transition={{
                opacity: { duration: CARD_IN_DURATION, delay: CARD_BASE_DELAY + i * CARD_STAGGER, ease },
                y: { duration: CARD_IN_DURATION, delay: CARD_BASE_DELAY + i * CARD_STAGGER, ease },
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

const analyzingLabel: Record<AgentId, string> = {
  problem:  "Pressure-testing",
  market:   "Mapping vectors",
  business: "Stress-testing margins",
  tech:     "Auditing feasibility",
};

const statusLabel = (status: AgentState["status"], agentId: AgentId): string => ({
  idle:         "Standby",
  initializing: "Triangulating",
  analyzing:    analyzingLabel[agentId],
  spoken:       "Standby",
  updating:     "Recalibrating",
}[status]);

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
      <motion.div
        className="relative rounded-lg bg-card/60 backdrop-blur-md border border-border/40 p-5 border-t-2"
        animate={{
          boxShadow: isAnalyzing
            ? [
                `0 0 8px 2px hsl(var(${agent.hslVar}) / 0.15), 0 0 20px 6px hsl(var(${agent.hslVar}) / 0.08)`,
                `0 0 14px 4px hsl(var(${agent.hslVar}) / 0.28), 0 0 36px 10px hsl(var(${agent.hslVar}) / 0.14)`,
                `0 0 8px 2px hsl(var(${agent.hslVar}) / 0.15), 0 0 20px 6px hsl(var(${agent.hslVar}) / 0.08)`,
              ]
            : active
            ? `0 0 10px 3px hsl(var(${agent.hslVar}) / 0.2), 0 0 24px 8px hsl(var(${agent.hslVar}) / 0.1)`
            : "0 0 0px 0px transparent",
        }}
        transition={isAnalyzing ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.7, ease }}
        style={{
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          borderTopColor: `hsl(var(${agent.hslVar}) / 0.7)`,
        }}
      >
        <div className="mb-3">
          <ConfidenceBar value={confidence} conflict={!!inConflict} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px] uppercase tracking-[0.24em] font-semibold"
              style={{ color: `hsl(var(${agent.hslVar}))` }}
            >
              {agent.role}
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60 mt-0.5">
              {statusLabel(state.status, agent.id)}
            </div>
            <div className="text-[12px] text-muted-foreground/70 font-light leading-snug mt-1 italic">
              {agent.note}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <motion.div
              className="font-display text-xl leading-none tabular-nums"
              animate={{ color: inConflict ? "hsl(var(--warning))" : "hsl(var(--foreground))" }}
              transition={{ duration: 0.6 }}
            >
              {confidence}
            </motion.div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              Confidence
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
              "mt-4 text-[15px] leading-relaxed font-light line-clamp-1",
              insight ? "text-foreground/85" : "text-muted-foreground/60 italic",
            )}
          >
            {insight ?? (isAnalyzing ? "Reading the brief…" : "Yet to speak.")}
          </motion.p>
        </AnimatePresence>

        {/* Sources: hide when done and nothing came back */}
        {(isAnalyzing || sources.length > 0) && (
          <div className="mt-4 pt-3 border-t border-border/60">
            <SourcesPanel
              agentId={agent.id}
              sources={sources}
              ready={sourcesReady}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};

/** Thin in-card load bar (not above the card, so it does not sit on the diagram spoke path). */
const ConfidenceBar = ({ value, conflict }: { value: number; conflict?: boolean }) => {
  const color = conflict ? "hsl(var(--warning))" : "hsl(var(--success))";
  return (
    <div className="w-full px-0">
      <div className="h-[3px] rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${Math.max(4, value)}%`, backgroundColor: color }}
          transition={{ width: { duration: 0.8, ease }, backgroundColor: { duration: 0.6, ease } }}
        />
      </div>
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
        className="flex w-full items-center justify-between gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-300"
      >
        <span className="flex items-center gap-2">
          <Globe className="h-3 w-3 opacity-80" />
          <span>{sources.length} sources checked</span>
        </span>
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
            <div data-lenis-prevent className="mt-3 max-h-64 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
              <ul className="space-y-2.5">
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
            </div>
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
      <div className="absolute rounded-full bg-card shadow-soft flex flex-col items-center justify-center text-center" style={{ inset: stroke / 2 }}>
        <div className="text-[10px] uppercase tracking-[0.24em] font-semibold text-muted-foreground">
          Lead Investor
        </div>
        <div className="font-display text-base mt-1.5 text-foreground italic">
          The Panel
        </div>
        <div className="text-2xl tabular-nums font-display mt-1.5 text-foreground">
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
