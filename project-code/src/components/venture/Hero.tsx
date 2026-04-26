import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, MoveRight } from "lucide-react";
import { FloatingPaths } from "@/components/FloatingPaths";

interface Props {
  onEnter: () => void;
  onExplore: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;
const headline = ["Ideas", "don't", "fail.", "Blindspots", "do."];
const ctaDelay = 0.4 + headline.length * 0.18 + 0.2;

export const Hero = ({ onEnter, onExplore }: Props) => {
  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      <FloatingPaths />
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

          {/* Badge pill */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="mb-10 flex justify-center"
          >
            <button
              onClick={onExplore}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:border-border hover:text-foreground"
            >
              Four investor perspectives. One verdict.
              <MoveRight className="h-3 w-3" />
            </button>
          </motion.div>

          {/* Letter-by-letter headline */}
          <h1 className="font-display text-5xl sm:text-7xl md:text-[6.5rem] leading-[1.02] font-normal text-foreground">
            {headline.map((word, wordIndex) => (
              <span key={wordIndex} className={`inline-block mr-[0.25em] last:mr-0 ${word === "Blindspots" ? "italic" : ""}`}>
                {word.split("").map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: 0.3 + wordIndex * 0.12 + letterIndex * 0.03,
                      type: "spring",
                      stiffness: 150,
                      damping: 25,
                    }}
                    className={`inline-block ${word === "Blindspots" ? "text-muted-foreground" : ""}`}
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: ctaDelay - 0.1, ease }}
            className="mt-7 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            Pitch your idea to a silent panel of AI investors. Get honest signal before you build.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: ctaDelay, ease }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
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

            <Button
              size="lg"
              variant="outline"
              onClick={onExplore}
              className="transition-transform duration-500 hover:scale-[1.02]"
              style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            >
              See how it works
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: ctaDelay + 0.15, ease }}
            className="mt-4 text-xs text-muted-foreground"
          >
            ~ 90 seconds · no signup
          </motion.p>
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
