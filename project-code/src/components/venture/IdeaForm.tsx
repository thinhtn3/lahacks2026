import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, ChevronDown, Mic, PenLine } from "lucide-react";
import { IdeaInput } from "@/lib/venture-types";
import { readinessScore } from "@/lib/venture-engine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VoiceCapture } from "./VoiceCapture";

interface Props {
  value: IdeaInput;
  onChange: (v: IdeaInput) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const HINTS = [
  "Who is it for?",
  "What problem does it solve?",
  "What do they use today?",
  "How does it make money?",
];

const ease = [0.22, 1, 0.36, 1] as const;

export const IdeaForm = ({ value, onChange, onSubmit, onBack }: Props) => {
  const set = <K extends keyof IdeaInput>(k: K, v: IdeaInput[K]) => onChange({ ...value, [k]: v });
  const readiness = useMemo(() => readinessScore(value), [value]);
  const readyLabel = readiness < 35 ? "Sparse" : readiness < 65 ? "Workable" : readiness < 85 ? "Strong" : "Excellent";

  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [description, setDescription] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [showStructured, setShowStructured] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const hasAnyStructured = Object.values(value).some((v) => (v ?? "").toString().trim().length > 0);
  const canSubmit = description.trim().length >= 20 || hasAnyStructured;

  const appendHint = (hint: string) => {
    setDescription((prev) => {
      const sep = prev.trim().length === 0 ? "" : prev.endsWith("\n") ? "" : "\n\n";
      return prev + sep + hint + " ";
    });
  };

  const handleExtract = async () => {
    if (description.trim().length < 20) {
      toast.error("Add a bit more detail first — a sentence or two.");
      return;
    }
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-idea", {
        body: { description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const idea = data?.idea ?? {};
      onChange({
        startupName: idea.startupName || "",
        industry: idea.industry || "",
        pitch: idea.pitch || "",
        targetUser: idea.targetUser || "",
        problem: idea.problem || "",
        alternatives: idea.alternatives || "",
        businessModel: idea.businessModel || "",
        technical: idea.technical || "",
      });
      setExtracted(true);
      setShowStructured(true);
      toast.success("Parsed only what you provided — refine any field below.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't parse the idea. Try again.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-background">
      <header className="relative z-10 flex items-center justify-between px-8 md:px-12 py-7">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Step 1 / 2 — Brief
        </div>
      </header>

      <main className="relative z-10 container max-w-2xl pb-40 pt-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] font-normal mb-5 text-foreground">
            {mode === "voice" ? "Pitch it out loud." : "Describe your idea."}
          </h1>
          <p className="text-muted-foreground mb-10 text-lg font-light leading-relaxed max-w-xl">
            {mode === "voice"
              ? "Speak naturally — like you're in the room. We'll transcribe and score your delivery."
              : "Write it however you want. We'll structure it for the panel — you can refine before running."}
          </p>

          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-10">
            <button
              onClick={() => setMode("voice")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 ${
                mode === "voice"
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              Record Pitch
            </button>
            <button
              onClick={() => setMode("text")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-300 ${
                mode === "text"
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              <PenLine className="h-3.5 w-3.5" />
              Type instead
            </button>
          </div>

          {/* Voice mode */}
          {mode === "voice" && (
            <VoiceCapture
              onApprove={(text) => {
                onChange({ ...value, pitch: text });
                onSubmit();
              }}
              onSwitchToText={() => setMode("text")}
            />
          )}

          {/* Text mode */}
          {mode === "text" && (
            <div className="space-y-8">
              <div>
                <Label className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Your idea
                </Label>
                <Textarea
                  rows={9}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Pernod is a marketplace for renting niche photography gear from local creators. It's for indie filmmakers in mid-size cities who can't afford rental shops..."
                  className="mt-4 resize-none text-base leading-relaxed bg-surface border-border rounded-2xl p-5 focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="mt-3 text-[11px] text-muted-foreground/80 font-light">
                  We only extract what you provide — refine any field before running the panel.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {HINTS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => appendHint(h)}
                      className="px-3 py-1.5 rounded-full border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {extracted ? "Re-parse to update fields" : "Step 1 — Parse with AI"}
                  </span>
                  <Button variant="terminal" onClick={handleExtract} disabled={extracting}>
                    {extracting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> {extracted ? "Re-parse" : "Parse idea"}</>
                    )}
                  </Button>
                </div>
              </div>

              <Collapsible open={showStructured} onOpenChange={setShowStructured}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-5 border-t border-border hover:opacity-70 transition-opacity"
                  >
                    <span className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground">02</span>
                      <span className="font-display text-xl">
                        {extracted ? "Review & refine" : "Add more detail"}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        {extracted ? "auto-filled" : "optional"}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showStructured ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-5 font-light">
                    We only extract what you provide — refine any field before running the panel.
                  </p>
                  <div className="space-y-6">
                    <Field label="Startup name" optional>
                      <Input value={value.startupName ?? ""} onChange={(e) => set("startupName", e.target.value)} placeholder="e.g. Halcyon" />
                    </Field>
                    <Field label="Industry" optional>
                      <Input value={value.industry ?? ""} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Healthcare, Fintech, SaaS" />
                    </Field>
                    <Field label="One-line pitch" optional>
                      <Input value={value.pitch ?? ""} onChange={(e) => set("pitch", e.target.value)} placeholder="A scheduling tool for indie therapists" />
                    </Field>
                    <Field label="Target user" optional>
                      <Input value={value.targetUser ?? ""} onChange={(e) => set("targetUser", e.target.value)} placeholder="Solo licensed therapists in the US" />
                    </Field>
                    <Field label="Problem" optional>
                      <Textarea rows={3} value={value.problem ?? ""} onChange={(e) => set("problem", e.target.value)} placeholder="What hurts today? Be specific." />
                    </Field>
                    <Field label="Existing alternatives" optional>
                      <Textarea rows={2} value={value.alternatives ?? ""} onChange={(e) => set("alternatives", e.target.value)} placeholder="What are users doing today instead?" />
                    </Field>
                    <Field label="Business model" optional>
                      <Input value={value.businessModel ?? ""} onChange={(e) => set("businessModel", e.target.value)} placeholder="Subscription, $29/mo per seat" />
                    </Field>
                    <Field label="Technical approach" optional>
                      <Input value={value.technical ?? ""} onChange={(e) => set("technical", e.target.value)} placeholder="React + Postgres, GPT-4o for parsing" />
                    </Field>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </motion.div>
      </main>

      {/* Sticky readiness bar — text mode only */}
      {mode === "text" && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/85 backdrop-blur-xl">
          <div className="container max-w-2xl py-5 flex items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Readiness</span>
                <span className="text-xs text-foreground tabular-nums">{readiness}% · {readyLabel}</span>
              </div>
              <div className="h-[2px] rounded-full bg-secondary overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: `${readiness}%` }}
                  transition={{ duration: 0.6, ease }}
                  className="h-full bg-foreground/80"
                />
              </div>
            </div>
            <Button variant="hero" size="lg" disabled={!canSubmit} onClick={() => {
                if (description.trim()) onChange({ ...value, pitch: description });
                onSubmit();
              }}>
              Run Panel
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: React.ReactNode }) => (
  <div className="space-y-2.5">
    <Label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
      {label}
      {required && <span className="text-foreground/60">*</span>}
      {optional && <span className="text-muted-foreground/60 normal-case tracking-normal">— optional</span>}
    </Label>
    {children}
  </div>
);
