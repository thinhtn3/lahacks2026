import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AGENTS, ClarificationRequest } from "@/lib/venture-types";
import { Mic, MicOff, Loader2, RotateCcw } from "lucide-react";

interface Props {
  request: ClarificationRequest | null;
  onSubmit: (answer: string) => void;
  onSkip?: () => void;
  onDismiss?: () => void;
}

type VoiceStage = "idle" | "recording" | "processing";

const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

const ease = [0.22, 1, 0.36, 1] as const;

export const ClarificationDialog = ({ request, onSubmit, onSkip, onDismiss }: Props) => {
  const [text, setText] = useState("");
  const [voiceStage, setVoiceStage] = useState<VoiceStage>("idle");
  const [liveText, setLiveText] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const srRef = useRef<any>(null);
  const finalTextRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceStageRef = useRef<VoiceStage>("idle");
  voiceStageRef.current = voiceStage;

  useEffect(() => {
    if (request) {
      setText("");
      setVoiceStage("idle");
      setLiveText("");
      cancelRecording();
    }
  }, [request]);

  useEffect(() => {
    if (voiceStage === "recording") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [voiceStage]);

  const startSR = () => {
    if (!SR) return;
    const sr = new SR();
    sr.continuous = true;
    sr.interimResults = true;
    sr.lang = "en-US";
    srRef.current = sr;
    sr.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalTextRef.current += (finalTextRef.current ? " " : "") + t.trim();
        } else {
          interim = t;
        }
      }
      setLiveText(finalTextRef.current + (interim ? " " + interim : ""));
    };
    sr.onend = () => { if (voiceStageRef.current === "recording") try { sr.start(); } catch {} };
    sr.onerror = () => {};
    try { sr.start(); } catch {}
  };

  const startRecording = async () => {
    setLiveText("");
    finalTextRef.current = "";
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }

    const mr = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "",
    });
    mediaRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(200);
    setVoiceStage("recording");
    startSR();
  };

  const stopAndTranscribe = () => {
    if (srRef.current) { try { srRef.current.stop(); } catch {} srRef.current = null; }
    const mr = mediaRef.current;
    if (!mr) return;
    const srFallback = finalTextRef.current;

    mr.onstop = async () => {
      mr.stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
      setVoiceStage("processing");

      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("file", blob, "answer.webm");
        const res = await fetch("/speech/transcribe", { method: "POST", body: form });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setText(data.text ?? srFallback);
      } catch {
        setText(srFallback);
      }
      setVoiceStage("idle");
    };
    mr.stop();
  };

  const cancelRecording = () => {
    if (srRef.current) { try { srRef.current.stop(); } catch {} srRef.current = null; }
    if (mediaRef.current) { try { mediaRef.current.stop(); } catch {} mediaRef.current = null; }
    finalTextRef.current = "";
    chunksRef.current = [];
    setLiveText("");
  };

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const agent = request ? AGENTS.find((a) => a.id === request.agentId) : null;
  const isRecording = voiceStage === "recording";
  const isProcessing = voiceStage === "processing";
  const hasText = text.trim().length > 0;

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) onDismiss?.(); }}>
      <DialogContent className="bg-background border-border max-w-lg rounded-3xl p-8 shadow-card">
        <DialogHeader className="space-y-3">
          <span
            className="text-[10px] uppercase tracking-[0.24em] font-semibold"
            style={agent ? { color: `hsl(var(${agent.hslVar}))` } : undefined}
          >
            {agent?.name} · {agent?.role}
          </span>
          <DialogTitle className="font-display text-3xl font-normal leading-tight">
            A quick question.
          </DialogTitle>
          <DialogDescription className="text-base text-foreground/80 leading-relaxed font-light pt-1">
            {request?.question}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">

          {/* ── IDLE: big mic + textarea ── */}
          {voiceStage === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease }}
              className="mt-6 flex flex-col items-center gap-5"
            >
              {/* Big mic button */}
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={startRecording}
                  className="relative flex items-center justify-center w-20 h-20 rounded-full bg-foreground text-background transition-transform duration-500 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
                >
                  <Mic className="h-8 w-8" />
                </button>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Tap to answer
                </p>
              </div>

              {/* Divider */}
              <div className="flex w-full items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground/60">or type</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Textarea */}
              <Textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="A sentence or two is plenty."
                className="w-full bg-surface border-border rounded-2xl p-4 resize-none text-sm"
              />

              {/* Footer */}
              <div className="flex w-full items-center justify-between">
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  skip
                </button>
                <Button variant="hero" disabled={!hasText} onClick={() => onSubmit(text.trim())}>
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── RECORDING ── */}
          {voiceStage === "recording" && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease }}
              className="mt-6 flex flex-col items-center gap-6"
            >
              {/* Pulsing mic */}
              <div className="relative flex items-center justify-center">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-foreground/10"
                    style={{ width: 80 + i * 24, height: 80 + i * 24 }}
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.12, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
                  />
                ))}
                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-foreground text-background">
                  <Mic className="h-8 w-8" />
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="tabular-nums">{fmtElapsed(elapsed)}</span>
              </div>

              {/* Live transcript */}
              {liveText && (
                <p className="text-sm text-foreground/70 font-light text-center max-w-xs leading-relaxed">
                  {liveText}
                </p>
              )}

              {/* Controls */}
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => { cancelRecording(); setVoiceStage("idle"); }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <Button variant="terminal" size="lg" onClick={stopAndTranscribe}>
                  <MicOff className="h-4 w-4" />
                  Done
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── PROCESSING ── */}
          {voiceStage === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              className="mt-6 flex flex-col items-center gap-4 py-8"
            >
              <Loader2 className="h-9 w-9 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground font-light">Transcribing…</p>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
