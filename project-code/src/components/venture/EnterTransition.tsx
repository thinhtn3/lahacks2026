import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  "Convening the board",
  "Calibrating perspectives",
  "Entering analysis",
];

interface Props { onDone: () => void }

export const EnterTransition = ({ onDone }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease }}
      onAnimationComplete={() => {
        // total dwell ~2s before handing off
        setTimeout(onDone, 1700);
      }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--primary) / 0.18), transparent 65%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease }}
        className="relative text-center"
      >
        <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground mb-8">
          Please hold
        </div>
        <div className="font-display text-3xl md:text-5xl text-foreground leading-tight min-h-[3em] flex flex-col items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <motion.div
              key={s}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -8] }}
              transition={{
                duration: 1.6,
                delay: 0.2 + i * 0.55,
                times: [0, 0.25, 0.75, 1],
                ease,
              }}
              className="absolute italic font-normal"
            >
              {s}
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 2, ease }}
          className="mt-12 mx-auto h-px w-40 bg-foreground/40 origin-left"
        />
      </motion.div>
    </motion.div>
  );
};
