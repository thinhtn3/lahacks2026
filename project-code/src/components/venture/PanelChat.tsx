import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import Lenis from "lenis";
import { AGENTS, ChatMessage } from "@/lib/venture-types";

interface Props {
  messages: ChatMessage[];
  onSend?: (text: string) => void;
  disabled?: boolean;
  disabledPlaceholder?: string;
  headerAction?: React.ReactNode;
  transcriptAction?: React.ReactNode;
  footerAction?: React.ReactNode;
}

const agentMap = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export const PanelChat = ({ messages, onSend, disabled, disabledPlaceholder, headerAction, transcriptAction, footerAction }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [text, setText] = useState("");

  // Scoped Lenis instance for smooth scroll inside this panel
  useEffect(() => {
    const wrapper = scrollRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const lenis = new Lenis({ wrapper, content, autoRaf: false });
    lenisRef.current = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Route header/footer wheel events into the scoped Lenis
  useEffect(() => {
    const root = panelRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      const scroller = scrollRef.current;
      if (!scroller) return;
      if (e.composedPath().includes(scroller)) return;
      e.preventDefault();
      const lenis = lenisRef.current;
      if (lenis) lenis.scrollTo((lenis as any).targetScroll + e.deltaY);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(Number.POSITIVE_INFINITY, { immediate: true });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend?.(text.trim());
    setText("");
  };

  return (
    <div
      ref={panelRef}
      className="flex h-full min-h-0 w-full min-w-0 max-h-full flex-col rounded-2xl px-5 pt-5 pb-4"
      style={{
        background: "hsl(240 8% 91%)",
        border: "1px solid hsl(240 6% 84%)",
        boxShadow: "0 2px 12px hsl(240 6% 70% / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.5)",
      }}
    >
      {/* Header */}
      <div
        className="flex flex-shrink-0 items-center justify-between pb-5"
        style={{ borderBottom: "1px solid hsl(240 6% 84%)" }}
      >
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.24em] font-semibold"
            style={{ color: "hsl(215 60% 55%)" }}
          >
            Transcript
          </div>
          <div className="font-display text-xl mt-1.5 font-bold text-foreground">Live commentary</div>
        </div>
        <div className="flex items-center gap-3">
          {headerAction}
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-soft-pulse" />
            <span>Converging...</span>
          </div>
        </div>
      </div>

      {/* Scroll wrapper — Lenis manages; overflow-hidden required */}
      <div
        ref={scrollRef}
        data-lenis-prevent
        className="min-h-0 min-w-0 flex-1 basis-0 overflow-hidden"
      >
        <div ref={contentRef} className="py-6 pr-1 space-y-7">
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground/70 italic font-light">
                The panel is gathering its thoughts…
              </p>
            )}
            {messages.map((m) => {
              const isUser = m.agentId === "user";
              const isOrch = m.agentId === "orchestrator";
              const agent = !isUser && !isOrch ? agentMap[m.agentId] : null;
              const label = isUser ? "You" : isOrch ? "Panel" : agent?.name;

              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className={`font-display text-lg font-bold tracking-tight ${isUser ? "italic text-muted-foreground" : ""}`}
                    style={agent ? { color: `hsl(var(${agent.hslVar}))` } : undefined}
                  >
                    {label}
                  </div>
                  <p className={`mt-1 ml-3 text-[17px] leading-relaxed font-light whitespace-pre-wrap ${isUser ? "text-muted-foreground" : "text-foreground/90"}`}>
                    {m.text}
                  </p>
                </motion.div>
              );
            })}
            {transcriptAction && (
              <motion.div
                key="transcript-action"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="pt-1"
              >
                {transcriptAction}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex flex-shrink-0 pt-4 w-full"
        style={{ borderTop: "1px solid hsl(240 6% 84%)" }}
      >
        {footerAction ? (
          <div className="flex justify-end w-full">{footerAction}</div>
        ) : (
          <div
            className="flex w-full items-center gap-2 rounded-full px-4 py-1.5 transition-colors focus-within:brightness-95"
            style={{ background: "hsl(0 0% 100% / 0.6)", border: "1px solid hsl(240 6% 82%)" }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={disabled ? (disabledPlaceholder ?? "Panel is speaking…") : "Add a thought…"}
              disabled={disabled}
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 outline-none disabled:opacity-50 py-2"
            />
            <button
              onClick={submit}
              disabled={disabled || !text.trim()}
              className="h-7 w-7 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-30 transition-opacity"
              aria-label="Send"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
