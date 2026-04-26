import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { AGENTS, ChatMessage } from "@/lib/venture-types";

interface Props {
  messages: ChatMessage[];
  onSend?: (text: string) => void;
  disabled?: boolean;
}

const agentMap = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

export const PanelChat = ({ messages, onSend, disabled }: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");

  // Auto-scroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend?.(text.trim());
    setText("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-5 border-b border-border">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Transcript</div>
          <div className="font-display text-xl mt-1.5">Live commentary</div>
        </div>
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-soft-pulse" />
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin py-6 space-y-7 pr-1">
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
            const sub = isUser ? "Founder" : isOrch ? "Moderator" : agent?.role;

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {sub}
                </div>
                <div className={`mt-1 font-display text-sm ${isUser ? "italic text-muted-foreground" : "text-foreground"}`}>
                  {label}
                </div>
                <p className={`mt-2 text-[15px] leading-relaxed font-light whitespace-pre-wrap ${isUser ? "text-muted-foreground" : "text-foreground/90"}`}>
                  {m.text}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 transition-colors focus-within:bg-secondary/70">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={disabled ? "Panel is speaking…" : "Add a thought…"}
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
      </div>
    </div>
  );
};
