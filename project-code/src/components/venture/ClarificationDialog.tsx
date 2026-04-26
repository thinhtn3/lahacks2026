import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AGENTS, ClarificationRequest } from "@/lib/venture-types";

interface Props {
  request: ClarificationRequest | null;
  onSubmit: (answer: string) => void;
  onDismiss?: () => void;
}

export const ClarificationDialog = ({ request, onSubmit, onDismiss }: Props) => {
  const [text, setText] = useState("");
  useEffect(() => { if (request) setText(""); }, [request]);

  const agent = request ? AGENTS.find((a) => a.id === request.agentId) : null;

  return (
    <Dialog open={!!request} onOpenChange={(open) => { if (!open) onDismiss?.(); }}>
      <DialogContent className="bg-background border-border max-w-lg rounded-3xl p-8 shadow-card">
        <DialogHeader className="space-y-3">
          <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            {agent?.name} · {agent?.role}
          </span>
          <DialogTitle className="font-display text-3xl font-normal leading-tight">
            A quick question.
          </DialogTitle>
          <DialogDescription className="text-base text-foreground/80 leading-relaxed font-light pt-1">
            {request?.question}
          </DialogDescription>
        </DialogHeader>

        <Textarea
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A sentence or two is plenty."
          className="bg-surface border-border rounded-2xl p-4 mt-2"
        />
        <div className="flex justify-end mt-2">
          <Button variant="hero" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
