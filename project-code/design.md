# PitchLab Design Document

## Overview

PitchLab is an AI-powered startup idea evaluation tool. Users describe their startup idea in a freeform text box, and a panel of four AI agents evaluates it across key dimensions: Problem & User, Market & Competition, Business & Distribution, and Technical Feasibility. The agents engage in a live panel discussion, ask clarifying questions, and produce a final evaluation report with scores and actionable feedback.

## Design Philosophy

- **Dark editorial aesthetic**: Deep navy background with warm cream text, evoking a high-end financial publication or premium SaaS dashboard.
- **Orbital intelligence**: The four agents orbit a central orchestrator, creating a visual metaphor for a live advisory panel.
- **Conversational depth**: Chat is the primary interaction surface; everything else (scores, reports) emerges from the dialogue.
- **Generous whitespace**: Large padding, clear hierarchy, and restrained use of color to maintain focus on the content.

## Tech Stack

- **Frontend**: React 18, Vite 5, TypeScript 5, Tailwind CSS v3, Framer Motion
- **Backend**: Supabase (Lovable Cloud) — Edge Functions for AI extraction
- **AI**: Lovable AI Gateway (Gemini 2.5 Pro) for structured idea extraction
- **Icons**: Lucide React
- **Fonts**: Fraunces (display), Inter (body), JetBrains Mono (data)

## Color System

All colors are defined as HSL CSS custom properties in `src/index.css` and mapped in `tailwind.config.ts`.

### Semantic Tokens

| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | `220 25% 6%` | Page background |
| `--foreground` | `40 30% 94%` | Primary text |
| `--surface` | `220 22% 9%` | Cards, panels |
| `--surface-elevated` | `220 20% 12%` | Elevated surfaces |
| `--primary` | `175 80% 55%` | Primary accent (teal) |
| `--primary-foreground` | `220 30% 8%` | Text on primary |
| `--accent` | `35 90% 60%` | Secondary accent (amber) |
| `--success` | `150 65% 50%` | Positive indicators |
| `--warning` | `35 90% 60%` | Caution indicators |
| `--destructive` | `0 75% 58%` | Errors, negative |
| `--muted` | `220 16% 16%` | Subtle backgrounds |
| `--muted-foreground` | `220 10% 60%` | Secondary text |
| `--border` | `220 18% 18%` | Dividers, borders |
| `--ring` | `175 80% 55%` | Focus rings |

### Agent Colors

| Agent | HSL | Tailwind Class |
|-------|-----|----------------|
| Problem & User | `175 80% 55%` | `text-[hsl(var(--agent-1))]` |
| Market & Competition | `260 75% 65%` | `text-[hsl(var(--agent-2))]` |
| Business & Distribution | `35 90% 60%` | `text-[hsl(var(--agent-3))]` |
| Technical Feasibility | `320 75% 65%` | `text-[hsl(var(--agent-4))]` |

### Gradients & Shadows

| Token | Value |
|-------|-------|
| `--gradient-radial` | `radial-gradient(ellipse at top, hsl(220 30% 12%) 0%, hsl(220 25% 6%) 60%)` |
| `--gradient-glow` | `radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)` |
| `--gradient-text` | `linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 100%)` |
| `--shadow-glow` | `0 0 40px hsl(var(--primary) / 0.35)` |
| `--shadow-elevated` | `0 20px 60px -20px hsl(220 50% 2% / 0.8)` |
| `--shadow-node` | `0 0 0 1px hsl(var(--border)), 0 10px 30px -10px hsl(220 50% 2% / 0.6)` |

## Typography

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display | Fraunces | 400–700 | Headlines, agent names, scores |
| Body | Inter | 300–700 | UI text, descriptions, chat |
| Mono | JetBrains Mono | 400–600 | Data, scores, labels |

### Scale

| Token | Size | Usage |
|-------|------|-------|
| `text-hero` | `clamp(2.5rem, 5vw, 4rem)` | Landing headline |
| `text-display` | `clamp(1.75rem, 3vw, 2.5rem)` | Section titles |
| `text-title` | `1.25rem` | Card titles, agent names |
| `text-body` | `1rem` | Body copy |
| `text-small` | `0.875rem` | Secondary text, labels |
| `text-xs` | `0.75rem` | Metadata, timestamps |

## Spacing System

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | `0.25rem` | Tight gaps |
| `space-2` | `0.5rem` | Inline spacing |
| `space-3` | `0.75rem` | Small padding |
| `space-4` | `1rem` | Default padding |
| `space-6` | `1.5rem` | Card padding |
| `space-8` | `2rem` | Section gaps |
| `space-12` | `3rem` | Large sections |
| `space-16` | `4rem` | Page sections |
| `space-24` | `6rem` | Hero spacing |

## Component Inventory

### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| `Landing` | `src/components/venture/Landing.tsx` | Marketing hero, CTA to start |
| `IdeaForm` | `src/components/venture/IdeaForm.tsx` | Freeform input + structured review panel |
| `Evaluation` | `src/components/venture/Evaluation.tsx` | Live panel with orbital agents + chat |
| `FinalReport` | `src/components/venture/FinalReport.tsx` | Evaluation report with scores and sections |

### UI Components (shadcn/ui)

All standard shadcn/ui components are available in `src/components/ui/`. Key ones used:

| Component | Usage |
|-----------|-------|
| `Button` | CTAs, actions |
| `Card` | Panels, containers |
| `Collapsible` | Expandable sections in report |
| `Dialog` | Clarification modal |
| `Input` | Text fields |
| `Textarea` | Freeform input |
| `Badge` | Status indicators |
| `Progress` | Evaluation readiness |
| `Separator` | Dividers |
| `Skeleton` | Loading states |
| `Tooltip` | Hints |

### Custom Components

| Component | File | Purpose |
|-----------|------|---------|
| `AgentNode` | `src/components/venture/AgentNode.tsx` | Orbital agent node with status, score, color |
| `PanelChat` | `src/components/venture/PanelChat.tsx` | Live chat feed with agent messages |
| `ClarificationDialog` | `src/components/venture/ClarificationDialog.tsx` | Modal for clarification questions |
| `NavLink` | `src/components/NavLink.tsx` | Navigation link component |

## Animation System

### Key Animations

| Animation | CSS/Framer | Usage |
|-----------|-----------|-------|
| `pulse-ring` | CSS keyframes | Active agent node ring |
| `node-glow` | CSS keyframes | Agent node inner glow |
| `fade-up` | CSS keyframes | Message entry |
| `orbit-rotate` | CSS keyframes | Orbital ring rotation |
| `dots` | CSS keyframes | Loading dots |
| Page transitions | Framer Motion `AnimatePresence` | Cross-fade between views |
| Agent activation | Framer Motion `layout` | Node position/size shifts |
| Chat scroll | Framer Motion `AnimatePresence` | New message slide-in |

### Timing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default easing |
| Duration fast | `150ms` | Hover, micro-interactions |
| Duration normal | `300ms` | Transitions, reveals |
| Duration slow | `500ms` | Page transitions |
| Duration dramatic | `800ms` | Hero animations |

## State Management

### Global State (React Context + useState)

| State | Type | Scope | Persistence |
|-------|------|-------|-------------|
| `view` | `landing \| form \| eval \| report` | App | None |
| `idea` | `IdeaInput` | App | None |
| `report` | `FinalReport \| null` | App | None |
| `agentStates` | `Record<AgentId, AgentState>` | Evaluation | None |
| `chatMessages` | `ChatMessage[]` | Evaluation | None |
| `clarification` | `ClarificationRequest \| null` | Evaluation | None |

### Data Flow

```
Landing → setView("form")
IdeaForm → setIdea(parsed) → setView("eval")
Evaluation → setAgentStates, setChatMessages, setClarification
Evaluation → handleComplete(scores) → setReport(buildFinalReport(idea, scores)) → setView("report")
FinalReport → setView("landing" | "form")
```

## API / Backend

### Edge Functions

| Function | Path | Method | Purpose |
|----------|------|--------|---------|
| `extract-idea` | `/functions/v1/extract-idea` | POST | Parse freeform idea text into structured fields |

### Request/Response

**Request:**
```json
{
  "text": "string (user's freeform description)"
}
```

**Response:**
```json
{
  "startupName": "string | null",
  "pitch": "string | null",
  "targetUser": "string | null",
  "problem": "string | null",
  "alternatives": "string | null",
  "businessModel": "string | null",
  "technical": "string | null"
}
```

### AI Extraction Prompt

The `extract-idea` function uses Lovable AI (Gemini 2.5 Pro) with a tool-calling schema. The system prompt instructs the model to:

1. Extract structured fields from unstructured text
2. Infer missing fields when possible
3. Return null for truly unknown fields
4. Keep outputs concise (1–2 sentences per field)
5. Preserve the user's original language

## File Structure

```
├── public/
│   ├── placeholder.svg
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── venture/
│   │   │   ├── AgentNode.tsx      # Orbital agent node
│   │   │   ├── ClarificationDialog.tsx  # Clarification modal
│   │   │   ├── Evaluation.tsx     # Live panel evaluation
│   │   │   ├── FinalReport.tsx    # Evaluation report
│   │   │   ├── IdeaForm.tsx       # Freeform input + review panel
│   │   │   ├── Landing.tsx        # Marketing hero
│   │   │   └── PanelChat.tsx      # Live chat feed
│   │   └── NavLink.tsx
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts          # Auto-generated
│   │       └── types.ts           # Auto-generated
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── venture-engine.ts      # Deterministic evaluation engine
│   │   └── venture-types.ts       # Type definitions
│   ├── pages/
│   │   ├── Index.tsx              # Main app shell
│   │   └── NotFound.tsx
│   ├── App.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   ├── config.toml
│   └── functions/
│       └── extract-idea/
│           └── index.ts           # AI extraction edge function
├── .env
├── index.html
├── tailwind.config.ts
├── components.json
└── package.json
```

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 640px | Single column, stacked layout, agents in vertical list |
| Tablet | 640–1024px | Two-column where possible, agents in compact orbit |
| Desktop | > 1024px | Full layout, orbital agent visualization, side-by-side chat |

## Accessibility

- All interactive elements have visible focus rings (`--ring` color)
- Color contrast meets WCAG AA (light text on dark backgrounds)
- Agent nodes have `aria-label` describing their role and status
- Chat messages are announced via `aria-live` region
- Reduced motion: disable orbital rotation and pulse animations when `prefers-reduced-motion` is set

## Future Considerations

1. **Real AI Evaluation**: Replace the deterministic `venture-engine.ts` with actual AI agents (one per role) that reason about the specific idea. Each agent would have its own system prompt and would generate genuine analysis rather than seeded heuristics.

2. **Persistent Storage**: Save evaluations to the database so users can revisit past reports. This would require:
   - `evaluations` table with RLS policies
   - `evaluation_agents` table for per-agent scores and messages
   - Auth integration for user accounts

3. **Shareable Reports**: Generate a public URL for each report so founders can share with co-founders or investors.

4. **Iteration History**: Track how an idea evolves across multiple evaluations, showing score changes over time.

5. **Custom Agents**: Allow users to add their own evaluation dimensions (e.g., "ESG Impact", "Regulatory Risk") with custom system prompts.

6. **Team Mode**: Multiple users can collaborate on the same idea, with each person's clarifications feeding into the panel discussion.

## Notes

- The current implementation uses a **deterministic engine** for the panel discussion. The same idea text will produce the same agent dialogue and scores every time. This is intentional for consistency during development but should be replaced with real AI for production.
- The `extract-idea` edge function is the only backend component. It uses Lovable AI (Gemini) with a tool-calling schema to parse freeform text into structured fields.
- All agent colors, animations, and orbital positions are driven by the `AGENTS` array in `venture-types.ts`. Adding a new agent only requires adding to this array — the UI will automatically adjust.
- The chat system supports inline user clarifications at any time. When a clarification is submitted, the orchestrator routes it to the most relevant agent(s), who update their scores and add reaction messages.
