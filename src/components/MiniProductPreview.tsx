import { motion } from "framer-motion";
import { TiltCard } from "@/components/TiltCard";

const COLUMNS = [
  { label: "In Progress", dotClass: "bg-warning", cards: ["Redesign onboarding flow", "Q3 budget review"] },
  { label: "Done", dotClass: "bg-success", cards: ["Ship command palette"] },
];

/** Compact kanban-style glass card used in premium marketing/auth surfaces. */
export function MiniProductPreview({ className }: { className?: string }) {
  return (
    <TiltCard strength={4} className={className}>
      <div className="rounded-2xl glass-strong overflow-hidden shadow-elevated">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive/80" />
            <span className="h-2 w-2 rounded-full bg-warning/80" />
            <span className="h-2 w-2 rounded-full bg-success/80" />
          </div>
          <div className="text-xs text-muted-foreground ml-2">ethixweb.os / dashboard</div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          {COLUMNS.map((col, ci) => (
            <div key={col.label} className="rounded-xl bg-secondary/40 p-3">
              <div className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-2">
                <span className={`h-1.5 w-1.5 rounded-full ${col.dotClass}`} />
                {col.label}
              </div>
              <div className="space-y-2">
                {col.cards.map((c, i) => (
                  <motion.div
                    key={c}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + ci * 0.15 + i * 0.08 }}
                    className="rounded-lg bg-card p-2.5 border border-border/60 text-xs font-medium"
                  >
                    {c}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TiltCard>
  );
}
