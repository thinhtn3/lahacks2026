import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, RotateCcw, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeliveryMetrics {
  pace: { wpm: number | null; label: string };
  fillers: { count: number; label: string };
  pauses: { count: number; label: string };
}

interface TranscribeResult {
  text: string;
  delivery_score: number;
  delivery_feedback: string;
  delivery_metrics: DeliveryMetrics;
}

type Stage = "idle" | "recording" | "processing" | "done" | "error";

interface Props {
  onApprove: (text: string) => void;
  onSwitchToText: () => void;
}

const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

const ease = [0.22, 1, 0.36, 1] as const;

export const VoiceCapture = ({ onApprove, onSwitchToText }: Props) => {
  const [stage, setStage] = useState<Stage>("idle");
  const [liveText, setLiveText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [editedText, setEditedText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const srRef = useRef<any>(null);
  const finalTextRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef<Stage>("idle");
  stageRef.current = stage;

  const hasSR = !!SR;

  // Elapsed timer
  useEffect(() => {
    if (stage === "recording") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  const startSpeechRecognition = () => {
    if (!hasSR) return;
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

    // Auto-restart on silence if still recording
    sr.onend = () => {
      if (stageRef.current === "recording") {
        try { sr.start(); } catch {}
      }
    };

    sr.onerror = () => {};

    try { sr.start(); } catch {}
  };

  const startRecording = async () => {
    setErrorMsg("");
    setLiveText("");
    finalTextRef.current = "";
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("Microphone access was denied. Please allow mic access and try again.");
      setStage("error");
      return;
    }

    const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
    mediaRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(200);

    setStage("recording");
    startSpeechRecognition();
  };

  const stopAndTranscribe = () => {
    // Stop speech recognition
    if (srRef.current) {
      try { srRef.current.stop(); } catch {}
      srRef.current = null;
    }

    const mr = mediaRef.current;
    if (!mr) return;

    const srTextAtStop = finalTextRef.current;

    mr.onstop = async () => {
      mr.stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;

      setStage("processing");

      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("file", blob, "pitch.webm");
        const res = await fetch("/speech/transcribe", { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }
        const data: TranscribeResult = await res.json();
        setResult(data);
        setEditedText(data.text);
        setStage("done");
      } catch {
        // Fall back to live SR text if available so the user isn't left empty-handed
        if (srTextAtStop.trim()) {
          const fallback: TranscribeResult = {
            text: srTextAtStop.trim(),
            delivery_score: 0,
            delivery_feedback: "Transcription service unavailable — using live preview. Review and edit if needed.",
            delivery_metrics: {
              pace: { wpm: null, label: "Unknown" },
              fillers: { count: 0, label: "None" },
              pauses: { count: 0, label: "Smooth" },
            },
          };
          setResult(fallback);
          setEditedText(fallback.text);
          setStage("done");
        } else {
          setErrorMsg("Transcription failed and no live preview was captured. Try again.");
          setStage("error");
        }
      }
    };

    mr.stop();
  };

  const reset = () => {
    if (srRef.current) { try { srRef.current.stop(); } catch {} srRef.current = null; }
    if (mediaRef.current) { try { mediaRef.current.stop(); } catch {} mediaRef.current = null; }
    finalTextRef.current = "";
    chunksRef.current = [];
    setLiveText("");
    setResult(null);
    setEditedText("");
    setErrorMsg("");
    setElapsed(0);
    setStage("idle");
  };

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const scoreColor = (score: number) =>
    score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div className="space-y-8">
      <AnimatePresence mode="wait">

        {/* ── IDLE ── */}
        {stage === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease }}
            className="flex flex-col items-center gap-8 py-10"
          >
            <div className="text-center space-y-2">
              <p className="text-muted-foreground font-light leading-relaxed max-w-sm">
                Press record, then pitch your idea out loud. Speak naturally — we'll handle the rest.
              </p>
            </div>

            <button
              onClick={startRecording}
              className="relative flex items-center justify-center w-24 h-24 rounded-full bg-foreground text-background transition-transform duration-500 hover:scale-105 focus:outline-none"
              style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
            >
              <Mic className="h-9 w-9" />
            </button>

            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Tap to begin</p>

            {!hasSR && (
              <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
                Live preview unavailable in this browser — your recording will still be transcribed by ElevenLabs.
              </p>
            )}
          </motion.div>
        )}

        {/* ── RECORDING ── */}
        {stage === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease }}
            className="flex flex-col items-center gap-6"
          >
            {/* Pulsing mic */}
            <div className="relative flex items-center justify-center mt-4">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-foreground/10"
                  style={{ width: 96 + i * 28, height: 96 + i * 28 }}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.15, 0.5] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.35, ease: "easeInOut" }}
                />
              ))}
              <div className="relative z-10 flex items-center justify-center w-24 h-24 rounded-full bg-foreground text-background">
                <Mic className="h-9 w-9" />
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="tabular-nums">{fmtElapsed(elapsed)}</span>
            </div>

            {/* Live transcript */}
            <div className="w-full space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {hasSR ? "Live transcript" : "Recording"}
              </p>
              <textarea
                rows={5}
                readOnly
                value={liveText}
                placeholder={hasSR ? "Start speaking — your words will appear here…" : "Recording… end pitch when done."}
                className="w-full resize-none text-base leading-relaxed bg-muted/30 border border-border rounded-2xl p-5 outline-none text-foreground/90 font-light placeholder:text-muted-foreground/60 placeholder:italic"
              />
            </div>

            <Button variant="terminal" size="lg" onClick={stopAndTranscribe}>
              <MicOff className="h-4 w-4" />
              End Pitch
            </Button>
          </motion.div>
        )}

        {/* ── PROCESSING ── */}
        {stage === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            className="flex flex-col items-center gap-5 py-16"
          >
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
            <div className="text-center space-y-1">
              <p className="font-display text-xl text-foreground">Transcribing your pitch…</p>
              <p className="text-sm text-muted-foreground font-light">ElevenLabs Scribe is processing your audio</p>
            </div>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {stage === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease }}
            className="space-y-6"
          >
            {/* Delivery score row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-baseline gap-1">
                <span className={`font-display text-4xl font-bold tabular-nums ${scoreColor(result.delivery_score)}`}>
                  {result.delivery_score}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Delivery</span>

              {/* Metric chips */}
              <div className="flex flex-wrap gap-2 ml-auto">
                <MetricChip label="Pace" value={result.delivery_metrics.pace.label} sub={result.delivery_metrics.pace.wpm ? `${result.delivery_metrics.pace.wpm} wpm` : undefined} />
                <MetricChip label="Fillers" value={result.delivery_metrics.fillers.label} sub={`${result.delivery_metrics.fillers.count} found`} />
                <MetricChip label="Pauses" value={result.delivery_metrics.pauses.label} />
              </div>
            </div>

            {/* Feedback */}
            <p className="text-xs text-muted-foreground font-light leading-relaxed border-l-2 border-border pl-4">
              {result.delivery_feedback}
            </p>

            {/* Editable transcript */}
            <div>
              <label className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground block mb-3">
                Transcript — edit if needed
              </label>
              <textarea
                rows={8}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full resize-none text-base leading-relaxed bg-muted/30 border border-border rounded-2xl p-5 outline-none focus:ring-1 focus:ring-ring text-foreground/90 font-light"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={reset}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart pitch
              </button>
              <Button
                variant="hero"
                size="lg"
                disabled={!editedText.trim()}
                onClick={() => onApprove(editedText.trim())}
              >
                Approve & Run Panel
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {stage === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            className="flex flex-col items-center gap-6 py-10 text-center"
          >
            <MicOff className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-2 max-w-sm">
              <p className="text-foreground/80">{errorMsg || "Something went wrong."}</p>
              <p className="text-sm text-muted-foreground font-light">
                You can{" "}
                <button onClick={reset} className="underline underline-offset-4 hover:text-foreground transition-colors">
                  try again
                </button>{" "}
                or{" "}
                <button onClick={onSwitchToText} className="underline underline-offset-4 hover:text-foreground transition-colors">
                  type your pitch instead
                </button>.
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

const MetricChip = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex flex-col items-center rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-center">
    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
    <span className="text-xs font-medium text-foreground">{value}</span>
    {sub && <span className="text-[10px] text-muted-foreground/70">{sub}</span>}
  </div>
);
