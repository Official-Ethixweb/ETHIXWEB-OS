import { useQuery } from "@tanstack/react-query";
import { Loader2, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { portalApi } from "@/api/portal";
import { format } from "date-fns";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-primary/15 text-primary border-primary/30",
  paid: "bg-success/15 text-success border-success/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function PortalInvoices() {
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ["portal", "invoices"], queryFn: portalApi.invoices });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">Billing history and outstanding invoices.</p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No invoices yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{inv.number}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Due {format(new Date(inv.dueDate), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="font-semibold tabular-nums">
                  {inv.currency} {inv.amount.toLocaleString()}
                </div>
                <Badge variant="outline" className={STATUS_STYLE[inv.status]}>{inv.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
