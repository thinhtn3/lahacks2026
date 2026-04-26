import { motion } from "framer-motion";
import { Agent, AgentState } from "@/lib/venture-types";
import { cn } from "@/lib/utils";

interface Props {
  agent: Agent;
  state: AgentState;
  active?: boolean;
  insight?: string;
}

const statusLabel: Record<AgentState["status"], string> = {
  idle: "Standby",
  initializing: "Preparing",
  analyzing: "Analyzing",
  spoken: "Spoke",
  updating: "Reconsidering",
};

export const AgentNode = ({ agent, state, active, insight }: Props) => {
  const score = state.score;
  const hasScore = score != null;
  const pct = hasScore ? Math.max(0, Math.min(100, score!)) : 0;

  return (
    <div
      className={cn(
        "group relative rounded-[20px] bg-card p-7 transition-all duration-700",
        active ? "shadow-card scale-[1.01]" : "shadow-soft",
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              {agent.role}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              · {statusLabel[state.status]}
            </span>
          </div>
          <div className="mt-2 font-display text-2xl text-foreground leading-tight">
            {agent.name}
          </div>
        </div>

        <ConfidenceRing pct={pct} hasScore={hasScore} active={active} />
      </div>

      <motion.div
        key={insight || "empty"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5"
      >
        {insight ? (
          <p className="text-[15px] leading-relaxed text-foreground/85 font-light">
            {insight}
          </p>
        ) : (
          <p className="text-[15px] leading-relaxed text-muted-foreground/70 font-light italic">
            {state.status === "analyzing" ? "Reading the brief…" : "Yet to speak."}
          </p>
        )}
      </motion.div>
    </div>
  );
};

const ConfidenceRing = ({ pct, hasScore, active }: { pct: number; hasScore: boolean; active?: boolean }) => {
  const size = 56;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--muted-foreground) / 0.5)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
        />
        {hasScore && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs tabular-nums ${hasScore ? "text-foreground" : "text-muted-foreground/50"} ${active ? "animate-soft-pulse" : ""}`}>
          {hasScore ? pct : "—"}
        </span>
      </div>
    </div>
  );
};
