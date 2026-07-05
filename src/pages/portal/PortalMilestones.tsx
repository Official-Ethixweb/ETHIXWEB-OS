import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ListChecks, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { portalApi } from "@/api/portal";
import { apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  completed: "bg-success/15 text-success border-success/30",
};

const APPROVAL_STYLE: Record<string, string> = {
  none: "bg-muted text-muted-foreground border-border",
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function PortalMilestones() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canApprove = (user?.permissions ?? []).includes("approvals.manage");
  const { data: milestones = [], isLoading } = useQuery({ queryKey: ["portal", "milestones"], queryFn: portalApi.milestones });

  const approvalMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) => portalApi.setMilestoneApproval(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal", "milestones"] });
      toast.success("Milestone updated");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update milestone")),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Milestones</h1>
        <p className="text-sm text-muted-foreground mt-1">Project milestones awaiting or already reviewed by you.</p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : milestones.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ListChecks className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No milestones yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <Card key={m.id}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.description}
                    {m.dueDate && ` · Due ${format(new Date(m.dueDate), "MMM d, yyyy")}`}
                  </div>
                </div>
                <Badge variant="outline" className={STATUS_STYLE[m.status]}>{m.status.replace("_", " ")}</Badge>
                <Badge variant="outline" className={APPROVAL_STYLE[m.approvalStatus]}>{m.approvalStatus}</Badge>
                {canApprove && m.approvalStatus === "pending" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-success border-success/30 hover:bg-success/10"
                      disabled={approvalMutation.isPending}
                      onClick={() => approvalMutation.mutate({ id: m.id, status: "approved" })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                      disabled={approvalMutation.isPending}
                      onClick={() => approvalMutation.mutate({ id: m.id, status: "rejected" })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
