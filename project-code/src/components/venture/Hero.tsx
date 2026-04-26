import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";

interface Props {
  onEnter: () => void;
  onExplore: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;
const headline = ["Ideas", "don't", "fail.", "Blindspots", "do."];

export const Hero = ({ onEnter, onExplore }: Props) => {
  return (
    <section className="relative min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Soft ambient gradient */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-8 md:px-12 py-7">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease }}
          className="font-display text-lg tracking-tight"
        >
          Pitch<span className="italic font-normal">Lab</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="text-xs text-muted-foreground hidden sm:block"
        >
          A quiet panel of experts.
        </motion.div>
      </header>

      <div className="relative z-10 flex-1 flex items-center">
        <div className="container max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease }}
            className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-12"
          >
            An investor panel for early ideas
          </motion.div>

          <h1 className="font-display text-5xl sm:text-7xl md:text-[6.5rem] leading-[1.02] font-normal text-foreground">
            {headline.map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.4 + i * 0.18, ease }}
                className={`inline-block mr-[0.25em] ${word === "Blindspots" ? "italic text-muted-foreground" : ""}`}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 + headline.length * 0.18 + 0.2, ease }}
            className="mt-16 flex flex-col items-center gap-5"
          >
            <Button
              size="lg"
              variant="hero"
              onClick={onEnter}
              className="group transition-transform duration-500 hover:scale-[1.02]"
              style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            >
              Enter the Board
              <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5" />
            </Button>
            <span className="text-xs text-muted-foreground">~ 90 seconds · no signup</span>
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.button
        onClick={onExplore}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 2.4, ease }}
        className="relative z-10 mx-auto mb-10 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Scroll to learn more"
      >
        <span className="text-[10px] uppercase tracking-[0.28em]">Scroll</span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>
    </section>
  );
};
