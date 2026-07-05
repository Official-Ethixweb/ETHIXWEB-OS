import { useQuery } from "@tanstack/react-query";
import { Loader2, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { portalApi } from "@/api/portal";
import { useAuth } from "@/context/AuthContext";

export default function PortalOverview() {
  const { user } = useAuth();
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["portal", "projects"], queryFn: portalApi.projects });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {user?.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here's what's shared with you at {user?.organization?.name}.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FolderKanban className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No projects have been shared with you yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  {p.name}
                </CardTitle>
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {p.doneCount}/{p.taskCount} tasks complete
                  </span>
                  <span className="font-medium">{p.progressPct}%</span>
                </div>
                <Progress value={p.progressPct} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
