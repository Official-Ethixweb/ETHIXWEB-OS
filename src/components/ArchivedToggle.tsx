import { Archive, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArchivedToggleProps {
  archived: boolean;
  onChange: (archived: boolean) => void;
}

/** Shared Active/Archived view switch, used on every archivable module's list page. */
export function ArchivedToggle({ archived, onChange }: ArchivedToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border/60 bg-secondary/40 p-0.5 text-sm">
      <button
        onClick={() => onChange(false)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors",
          !archived ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Inbox className="h-3.5 w-3.5" /> Active
      </button>
      <button
        onClick={() => onChange(true)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors",
          archived ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Archive className="h-3.5 w-3.5" /> Archived
      </button>
    </div>
  );
}
