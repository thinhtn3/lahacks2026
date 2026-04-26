
import { useEffect, useMemo, useRef, useState } from "react";
import { AGENT_TO_DOMAIN, BackendAgentResult, BackendClarifyingQA, BackendDomain, DOMAIN_TO_AGENT, StreamCallbacks, agentResultToTurns, streamAnalysis, submitClarify } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";
import { AgentId, AgentSource, AgentState, ChatMessage, ClarificationRequest, IdeaInput, AGENTS } from "@/lib/venture-types";
import { AgentTurn, makeMessage } from "@/lib/venture-engine";
import { AgentDiagram } from "./AgentDiagram";
import { PanelChat } from "./PanelChat";
import { ClarificationDialog } from "./ClarificationDialog";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  input: IdeaInput;
  onBack: () => void;
  onComplete: (scores: Record<AgentId, number>, agents: BackendAgentResult[], history: BackendClarifyingQA[]) => void;
}

const initialState = (): Record<AgentId, AgentState> => ({
  problem:  { status: "initializing", score: null, confidence: 18, conflict: false, sources: [] },
  market:   { status: "initializing", score: null, confidence: 22, conflict: false, sources: [] },
  business: { status: "initializing", score: null, confidence: 15, conflict: false, sources: [] },
  tech:     { status: "initializing", score: null, confidence: 20, conflict: false, sources: [] },
});

const ease = [0.22, 1, 0.36, 1] as const;

export const Evaluation = ({ input, onBack, onComplete }: Props) => {
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>(initialState());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentId | "orchestrator" | null>(null);
  const [clarification, setClarification] = useState<ClarificationRequest | null>(null);
  const [phase, setPhase] = useState<"intro" | "panel" | "awaiting" | "reeval" | "done">("intro");
  const [conflicts, setConflicts] = useState<Array<[AgentId, AgentId]>>([]);
  const queueRef = useRef<AgentTurn[]>([]);
  const completedRef = useRef(false);
  const streamingDoneRef = useRef(false);
  const agentStatesRef = useRef(agentStates);
  agentStatesRef.current = agentStates;
  const backendAgentsRef = useRef<{ agents: BackendAgentResult[]; history: BackendClarifyingQA[] }>({ agents: [], history: [] });
  const pendingDomainsRef = useRef<BackendDomain[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);
  const [streamReady, setStreamReady] = useState(false);

  const [sourcesByAgent, setSourcesByAgent] = useState<Record<AgentId, AgentSource[]>>(
    { problem: [], market: [], business: [], tech: [] }
  );

  const [panelWidth, setPanelWidth] = useState(400);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startWidth: panelWidth };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - e.clientX;
      setPanelWidth(Math.min(640, Math.max(280, dragRef.current.startWidth + delta)));
    };
    const onMouseUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Track latest insight per agent
  const latestInsight = useMemo(() => {
    const map: Partial<Record<AgentId, string>> = {};
    for (const m of messages) {
      if (m.agentId !== "user" && m.agentId !== "orchestrator") {
        map[m.agentId] = m.text;
      }
    }
    return map;
  }, [messages]);

  // initial sequence
  useEffect(() => {
    const t1 = setTimeout(() => {
      setAgentStates((s) => {
        const next = { ...s };
        (Object.keys(next) as AgentId[]).forEach((k) => (next[k] = { ...next[k], status: "analyzing" }));
        return next;
      });
    }, 700);
    const t2 = setTimeout(() => {
      streamingDoneRef.current = false;
      backendAgentsRef.current = { agents: [], history: [] };
      pendingDomainsRef.current = [];
      setStreamReady(false);
      setPhase("panel");
      const idea = input.pitch || Object.values(input).filter(Boolean).join("\n");
      const callbacks: StreamCallbacks = {
        onTurn: (turn) => {
          queueRef.current = [...queueRef.current, turn];
          setQueueVersion((v) => v + 1);
        },
        onSources: (agentId, sources) => setSourcesByAgent((s) => ({ ...s, [agentId]: sources })),
        onDone: (agents) => {
          backendAgentsRef.current = { agents, history: [] };
          pendingDomainsRef.current = agents
            .filter((a) => a.confidence < 50)
            .sort((a, b) => a.confidence - b.confidence)
            .map((a) => a.domain);
          streamingDoneRef.current = true;
          setStreamReady(true);
        },
        onError: (err) => {
          console.error("Stream error:", err);
          streamingDoneRef.current = true;
          setStreamReady(true);
        },
      };
      streamAnalysis(idea, callbacks);
    }, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [input]);

  // Confidence fluctuation loop — keeps bars alive during analysis, locks once score is set.
  useEffect(() => {
    if (phase === "done") return;
    const interval = setInterval(() => {
      setAgentStates((s) => {
        const next = { ...s };
        for (const k of Object.keys(next) as AgentId[]) {
          const a = next[k];
          if (a.score !== null) {
            // Score established — pin confidence exactly, no more movement.
            if (a.confidence !== a.score) next[k] = { ...a, confidence: a.score };
            continue;
          }
          // Still analyzing — wander around a mid value.
          const target = 35 + Math.sin(Date.now() / 1100 + k.length) * 18 + Math.random() * 8;
          const nextConf = a.confidence + (target - a.confidence) * 0.18 + (Math.random() - 0.5) * 4;
          next[k] = { ...a, confidence: Math.max(8, Math.min(98, nextConf)) };
        }
        return next;
      });
    }, 320);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "panel" && phase !== "reeval") return;
    if (queueRef.current.length === 0) {
      if (phase === "panel" && !streamingDoneRef.current) return;
      const pending = pendingDomainsRef.current;
      if (pending.length === 0) {
        setPhase("done");
        return;
      }
      const nextDomain = pending[0];
      pendingDomainsRef.current = pending.slice(1);
      const agents = backendAgentsRef.current.agents;
      const agent = agents.find((a) => a.domain === nextDomain);
      if (!agent?.clarifying_question) {
        setPhase("done");
        return;
      }
      const req: ClarificationRequest = {
        id: Math.random().toString(36).slice(2),
        agentId: DOMAIN_TO_AGENT[nextDomain],
        question: agent.clarifying_question,
      };
      setTimeout(() => {
        setClarification(req);
        setPhase("awaiting");
      }, 800);
      return;
    }
    const turn = queueRef.current[0];
    const delay = messages.length === 0 ? 300 : 1300 + Math.random() * 500;
    const timer = setTimeout(() => {
      queueRef.current = queueRef.current.slice(1);
      applyTurn(turn);
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, messages.length, streamReady, queueVersion]); // eslint-disable-line

  const applyTurn = (turn: AgentTurn) => {
    setActiveAgent(turn.agentId);
    setMessages((m) => [...m, makeMessage(turn)]);

    // Conflicts
    if (turn.resolveConflicts) {
      setConflicts([]);
      setAgentStates((s) => {
        const next = { ...s };
        for (const k of Object.keys(next) as AgentId[]) next[k] = { ...next[k], conflict: false };
        return next;
      });
    }
    if (turn.conflictWith && turn.conflictWith.length === 2) {
      const [a, b] = turn.conflictWith;
      setConflicts((cs) => [...cs, [a, b]]);
      setAgentStates((s) => {
        const next = { ...s };
        next[a] = { ...next[a], conflict: true };
        next[b] = { ...next[b], conflict: true };
        return next;
      });
    }

    setAgentStates((s) => {
      const next = { ...s };
      if (turn.agentId !== "orchestrator") {
        next[turn.agentId] = { ...next[turn.agentId], status: "spoken" };
      }
      if (turn.setScore) {
        for (const k of Object.keys(turn.setScore) as AgentId[]) {
          const score = turn.setScore[k]!;
          next[k] = { ...next[k], score, status: "spoken" };
          const agentName = AGENTS.find((a) => a.id === k)?.name ?? k;
          console.log(`[Agent score] ${agentName} (${k}): ${score}`);
        }
      }
      if (turn.scoreDelta) {
        for (const k of Object.keys(turn.scoreDelta) as AgentId[]) {
          const cur = next[k].score ?? 50;
          next[k] = { ...next[k], score: clamp(cur + (turn.scoreDelta[k] ?? 0)) };
        }
      }
      return next;
    });
    setTimeout(() => setActiveAgent((a) => (a === turn.agentId ? null : a)), 1400);
  };

  const handleClarificationSubmit = async (answer: string, agentId: AgentId) => {
    setClarification(null);
    setMessages((m) => [...m, { id: Math.random().toString(36).slice(2), agentId: "user", text: answer, timestamp: Date.now() }]);
    setAgentStates((s) => ({ ...s, [agentId]: { ...s[agentId], status: "updating" } }));
    const { agents, history } = backendAgentsRef.current;
    const domain = AGENT_TO_DOMAIN[agentId];
    const question = agents.find((a) => a.domain === domain)?.clarifying_question ?? "";
    const ideaText = input.pitch || Object.values(input).filter(Boolean).join("\n");
    try {
      const data = await submitClarify(ideaText, agents, history, domain, question, answer);
      backendAgentsRef.current = { agents: data.agents, history: data.history };
      pendingDomainsRef.current = data.pending_domains;
      const updatedAgent = data.agents.find((a) => a.domain === domain);
      queueRef.current = updatedAgent ? agentResultToTurns(updatedAgent) : [];
    } catch (err) {
      console.error("Clarify failed:", err);
      toast.error("Clarification service unavailable");
      setPhase("done");
      return;
    }
    setTimeout(() => setPhase("reeval"), 600);
  };

  const handleInlineSend = (text: string) => {
    if (phase === "awaiting" && clarification) {
      handleClarificationSubmit(text, clarification.agentId);
      return;
    }
    const lowest = (Object.keys(agentStates) as AgentId[]).reduce((acc, k) =>
      (agentStates[k].score ?? 100) < (agentStates[acc].score ?? 100) ? k : acc, "problem" as AgentId);
    handleClarificationSubmit(text, lowest);
  };

  useEffect(() => {
    if (phase !== "done" || completedRef.current) return;
    completedRef.current = true;
    const snap = agentStatesRef.current;
    const scores = (Object.keys(snap) as AgentId[]).reduce((acc, k) => {
      acc[k] = snap[k].score ?? 50;
      return acc;
    }, {} as Record<AgentId, number>);
    setAgentStates((s) => {
      const next = { ...s };
      for (const k of Object.keys(next) as AgentId[]) next[k] = { ...next[k], confidence: scores[k], conflict: false };
      return next;
    });
    setConflicts([]);
    const t = setTimeout(() => onComplete(scores, backendAgentsRef.current.agents, backendAgentsRef.current.history), 1600);
    return () => clearTimeout(t);
  }, [phase, onComplete]); // agentStates intentionally excluded — read via ref to prevent setAgentStates from cancelling the timeout

  // Central confidence: builds as each agent reports in.
  // Only spoken agents (score !== null) contribute — the ring climbs progressively.
  const centralConfidence = useMemo(() => {
    if (phase === "intro") return 0;
    const spoken = AGENTS.filter((a) => agentStates[a.id].score !== null);
    if (spoken.length === 0) return 0;
    return spoken.reduce((acc, a) => acc + agentStates[a.id].confidence, 0) / spoken.length;
  }, [agentStates, phase]);

  const centralResolved = phase === "done";
  const isPanelSpeaking = phase === "panel" || phase === "reeval";
  const phaseLabel =
    phase === "intro" ? "Convening panel" :
    phase === "panel" ? "Panel deliberating" :
    phase === "awaiting" ? "Awaiting your input" :
    phase === "reeval" ? "Updating evaluation" :
    "Synthesizing report";

  const transcriptCollapsed = !!clarification;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative bg-background">
      <header className="flex-shrink-0 relative z-10 flex items-center justify-between px-8 md:px-12 py-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span>Edit brief</span>
        </button>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {phaseLabel}<span className="loading-dots ml-1" />
        </div>
        <div className="text-xs text-muted-foreground hidden md:block">
          {input.startupName || "Untitled"}
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 flex-1 min-h-0 grid px-8 md:px-12 pt-2 pb-6",
          transcriptCollapsed
            ? "lg:grid-cols-[1fr]"
            : "lg:grid-cols-[1fr_auto] lg:gap-10",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex-shrink-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">The Panel</div>
            <h2 className="font-display text-2xl md:text-3xl mt-1 leading-tight">
              Four perspectives, in conversation.
            </h2>
          </div>

          <div className="flex-1 min-h-0">
            <AgentDiagram
              agentStates={agentStates}
              activeAgent={activeAgent}
              insights={latestInsight}
              sourcesByAgent={sourcesByAgent}
              centralConfidence={centralConfidence}
              centralResolved={centralResolved}
              conflicts={conflicts}
              appearedAt={0}
            />
          </div>
        </div>

        <AnimatePresence>
          {!transcriptCollapsed && (
            <motion.div
              key="transcript"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.7, ease }}
              className="relative min-h-0"
              style={{ width: panelWidth, overflow: "hidden" }}
            >
              <div
                onMouseDown={handleDragStart}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-border/60 transition-colors"
              />
              <PanelChat messages={messages} onSend={handleInlineSend} disabled={isPanelSpeaking} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ClarificationDialog
        request={clarification}
        onSubmit={(answer) => clarification && handleClarificationSubmit(answer, clarification.agentId)}
        onDismiss={() => { setClarification(null); setPhase("done"); }}
      />
    </div>
  );
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
