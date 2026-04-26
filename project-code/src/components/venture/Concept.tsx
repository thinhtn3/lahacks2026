import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface Props {
  onEnter: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

const STATEMENTS = [
  { eyebrow: "01", line: "Four investor perspectives." },
  { eyebrow: "02", line: "One quiet conversation." },
  { eyebrow: "03", line: "No blindspots." },
];

const PERSPECTIVES = [
  { mark: "I",   note: "Listens for the ache underneath the pitch." },
  { mark: "II",  note: "Maps the terrain where the idea must live." },
  { mark: "III", note: "Follows the quiet path of the money." },
  { mark: "IV",  note: "Tests what holds when the load arrives." },
];

export const Concept = ({ onEnter }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const y2 = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <div ref={ref} className="relative bg-background">
      {/* Statements */}
      <section className="relative py-40 md:py-56">
        <div className="container max-w-3xl">
          <Reveal>
            <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-20 text-center">
              The Concept
            </div>
          </Reveal>

          <div className="space-y-32 md:space-y-40">
            {STATEMENTS.map((s, i) => (
              <Reveal key={i} delay={0}>
                <motion.div
                  style={{ y: i % 2 === 0 ? y1 : y2 }}
                  className="text-center"
                >
                  <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-6">
                    {s.eyebrow}
                  </div>
                  <h2 className="font-display text-5xl md:text-7xl leading-[1.05] text-foreground font-normal">
                    {s.line}
                  </h2>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Floating perspective cards — abstract, unlabeled */}
      <section className="relative py-32 md:py-44">
        <div className="container max-w-5xl">
          <Reveal>
            <div className="text-center mb-20">
              <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-6">
                The Conversation
              </div>
              <h2 className="font-display text-4xl md:text-5xl leading-tight text-foreground">
                Four perspectives, in quiet exchange.
              </h2>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-6 md:gap-8">
            {PERSPECTIVES.map((p, i) => (
              <Reveal key={p.mark} delay={i * 0.1}>
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 7 + i,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.4,
                  }}
                  whileHover={{ y: -2 }}
                  className="rounded-[20px] bg-card shadow-soft p-10 hover:shadow-card transition-shadow duration-700"
                  style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                >
                  <div className="font-display text-sm tracking-[0.3em] text-muted-foreground/70">
                    {p.mark}
                  </div>
                  <p className="mt-6 text-[17px] text-foreground/85 leading-relaxed font-light">
                    {p.note}
                  </p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative py-40 md:py-56">
        <div className="container max-w-2xl text-center">
          <Reveal>
            <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground mb-8">
              When you're ready
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.05] text-foreground italic">
              Bring an idea.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-8 text-lg text-muted-foreground font-light leading-relaxed max-w-lg mx-auto">
              The board convenes the moment you press enter. Take your time —
              the room is patient.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-14">
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
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
    transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);
