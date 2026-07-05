import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { portalApi } from "@/api/portal";
import { format } from "date-fns";

const STATUS_STYLE: Record<string, string> = {
  todo: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  done: "bg-success/15 text-success border-success/30",
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/15 text-primary border-primary/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function PortalTasks() {
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["portal", "tasks"], queryFn: portalApi.tasks });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">Tasks assigned to you across shared projects.</p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CheckSquare className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No tasks yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-4 flex items-center gap-4">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.projectColor || "hsl(var(--muted-foreground))" }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.projectName}
                    {t.dueDate && ` · Due ${format(new Date(t.dueDate), "MMM d, yyyy")}`}
                  </div>
                </div>
                <Badge variant="outline" className={PRIORITY_STYLE[t.priority]}>{t.priority}</Badge>
                <Badge variant="outline" className={STATUS_STYLE[t.status]}>{t.status.replace("_", " ")}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
