import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { FinalReport as FR } from "@/lib/venture-types";
import { Download, Pencil, RotateCcw } from "lucide-react";

interface Props {
  report: FR;
  onRestart: () => void;
  onEdit: () => void;
  onExport: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

export const FinalReport = ({ report, onRestart, onEdit, onExport }: Props) => {
  return (
    <div className="min-h-screen relative bg-background">
      <header className="relative z-10 px-8 md:px-12 py-7 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Evaluation</div>
        <div className="text-xs text-muted-foreground">Report · v1</div>
      </header>

      <main className="relative z-10 container max-w-2xl py-16 pb-32">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }}>
          <div className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-12">
              You're early — this feedback is meant to help you refine.
            </p>

            <div className="flex justify-center mb-10">
              <ScoreRing value={report.overallScore} />
            </div>

            <p className="font-display text-2xl md:text-3xl italic leading-snug text-foreground/90 max-w-xl mx-auto">
              {report.takeaway}
            </p>
          </div>

          <Accordion type="multiple" defaultValue={["summary"]} className="space-y-1">
            <ReportSection value="summary" title="Summary">
              <p className="text-foreground/85 leading-relaxed font-light">{report.summary}</p>
            </ReportSection>
            <ReportSection value="working" title="What's Working">
              <BulletList items={report.strengths} />
            </ReportSection>
            <ReportSection value="needs" title="What Needs Improvement">
              <BulletList items={report.risks} />
            </ReportSection>
            <ReportSection value="insight" title="Key Insight">
              <p className="font-display text-xl italic leading-snug text-foreground/85">{report.insight}</p>
            </ReportSection>
            <ReportSection value="strengthen" title="How to Strengthen">
              <BulletList items={report.strengthen} />
            </ReportSection>
            <ReportSection value="next" title="Next Steps">
              <BulletList items={report.nextSteps} />
            </ReportSection>
          </Accordion>

          <div className="mt-16 flex flex-wrap gap-3 justify-center">
            <Button variant="hero" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" /> Evaluate again
            </Button>
            <Button variant="terminal" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit idea
            </Button>
            <Button variant="terminal" onClick={onExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

const ScoreRing = ({ value }: { value: number }) => {
  const size = 160;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="finalRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--muted-foreground) / 0.5)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#finalRing)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl tabular-nums text-foreground">{value}</span>
        <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mt-1">/ 100</span>
      </div>
    </div>
  );
};

const ReportSection = ({ value, title, children }: { value: string; title: string; children: React.ReactNode }) => (
  <AccordionItem value={value} className="border-b border-border last:border-b-0 border-t-0">
    <AccordionTrigger className="hover:no-underline py-5 group">
      <span className="font-display text-xl text-foreground text-left">{title}</span>
    </AccordionTrigger>
    <AccordionContent className="pb-6 pt-1">{children}</AccordionContent>
  </AccordionItem>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="space-y-3">
    {items.map((it, i) => (
      <li key={i} className="flex gap-4 text-foreground/85 leading-relaxed font-light">
        <span className="text-xs text-muted-foreground tabular-nums pt-1.5 w-6 shrink-0">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span>{it}</span>
      </li>
    ))}
  </ul>
);
