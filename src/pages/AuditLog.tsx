import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { auditLogApi } from "@/api/auditLog";

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const limit = 50;
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () => auditLogApi.list(page, limit),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground mt-1">A record of sensitive actions taken across your workspace.</p>
      </div>

      <div className="glass rounded-3xl p-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.entries.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-primary/20 grid place-items-center mb-3">
              <History className="h-6 w-6 text-primary-glow" />
            </div>
            <div className="font-semibold">No activity yet</div>
            <div className="text-sm text-muted-foreground mt-1">Sensitive actions will show up here as they happen.</div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {data.entries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{e.actor?.name ?? "Unknown"}</span>{" "}
                      <span className="text-muted-foreground">{e.action}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.resourceType}
                      {e.ip ? ` · ${e.ip}` : ""} · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary/60 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary/60 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
