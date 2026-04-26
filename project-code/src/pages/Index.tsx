import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hero } from "@/components/venture/Hero";
import { Concept } from "@/components/venture/Concept";
import { EnterTransition } from "@/components/venture/EnterTransition";
import { CursorGlow } from "@/components/venture/CursorGlow";
import { IdeaForm } from "@/components/venture/IdeaForm";
import { Evaluation } from "@/components/venture/Evaluation";
import { FinalReport } from "@/components/venture/FinalReport";
import { AgentId, FinalReport as FR, IdeaInput } from "@/lib/venture-types";
import { buildFinalReport } from "@/lib/venture-engine";
import { BackendAgentResult, BackendClarifyingQA, fetchVerdict } from "@/lib/api";
import { toast } from "sonner";

type View = "intro" | "concept" | "form" | "eval" | "report";

const EVAL_STATE_KEY = "venture-eval-state";
const APP_STATE_KEY  = "venture-app-state";

const empty: IdeaInput = {
  startupName: "", industry: "", pitch: "", targetUser: "", problem: "",
  alternatives: "", businessModel: "", technical: "",
};

function loadAppState() {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const ease = [0.22, 1, 0.36, 1] as const;

const Index = () => {
  const [view, setView] = useState<View>(() => {
    const s = loadAppState();
    return (s?.view === "eval" || s?.view === "report") ? s.view : "intro";
  });
  const [transitioning, setTransitioning] = useState(false);
  const [idea, setIdea] = useState<IdeaInput>(() => loadAppState()?.idea ?? empty);
  const [report, setReport] = useState<FR | null>(() => loadAppState()?.report ?? null);

  // Persist view + report + idea whenever they change (only for eval/report states)
  useEffect(() => {
    if (view === "eval" || view === "report") {
      try {
        localStorage.setItem(APP_STATE_KEY, JSON.stringify({ view, report, idea }));
      } catch { /* storage full */ }
    }
  }, [view, report, idea]);

  const enterApp = () => {
    setTransitioning(true);
  };

  const finishTransition = () => {
    setView("form");
    setTransitioning(false);
  };

  const scrollToConcept = () => {
    document.getElementById("concept-anchor")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleComplete = useCallback(async (scores: Record<AgentId, number>, agents: BackendAgentResult[], history: BackendClarifyingQA[]) => {
    const ideaText = idea.pitch || Object.values(idea).filter(Boolean).join("\n");
    try {
      const r = await fetchVerdict(ideaText, agents, history);
      setReport(r);
      setView("report");
    } catch (err) {
      console.error("Verdict failed, falling back to local:", err);
      setReport(buildFinalReport(idea, scores));
      setView("report");
    }
  }, [idea]);

  const handleExport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ idea, report }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pitchlab-${(idea.startupName || "idea").toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  const clearStorage = () => {
    localStorage.removeItem(EVAL_STATE_KEY);
    localStorage.removeItem(APP_STATE_KEY);
  };

  const restart = () => {
    clearStorage();
    setIdea(empty);
    setReport(null);
    setView("intro");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <>
      <CursorGlow />

      <AnimatePresence mode="wait">
        {view === "intro" && (
          <motion.div
            key="intro-stack"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.985, filter: "blur(4px)" }}
            transition={{ duration: 0.8, ease }}
          >
            <Hero onEnter={enterApp} onExplore={scrollToConcept} />
            <div id="concept-anchor" />
            <Concept onEnter={enterApp} />
          </motion.div>
        )}

        {view === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 1.01 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease }}
          >
            <IdeaForm
              value={idea}
              onChange={setIdea}
              onSubmit={() => { clearStorage(); setView("eval"); }}
              onBack={() => { setView("intro"); window.scrollTo({ top: 0, behavior: "auto" }); }}
            />
          </motion.div>
        )}

        {view === "eval" && (
          <motion.div
            key="eval"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <Evaluation
              input={idea}
              onBack={() => setView("form")}
              onRestart={restart}
              onComplete={handleComplete}
              onViewReport={report ? () => setView("report") : undefined}
            />
          </motion.div>
        )}

        {view === "report" && report && (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            <FinalReport
              report={report}
              onBack={() => setView("eval")}
              onRestart={restart}
              onEdit={() => { clearStorage(); setView("form"); }}
              onExport={handleExport}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {transitioning && <EnterTransition onDone={finishTransition} />}
      </AnimatePresence>
    </>
  );
};

export default Index;
