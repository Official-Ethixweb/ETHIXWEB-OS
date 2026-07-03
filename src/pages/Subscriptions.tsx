import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, CreditCard, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscriptionsApi, type SubscriptionInput } from "@/api/subscriptions";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RenewalBadge } from "@/components/RenewalBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArchivedToggle } from "@/components/ArchivedToggle";
import { DataTable, type DataTableColumn, type RowAction } from "@/components/DataTable";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { FINANCE_COMPANY_ROLES, type BillingCycle, type Subscription } from "@/types";
import { format } from "date-fns";

const BILLING_CYCLES: BillingCycle[] = ["monthly", "yearly", "weekly", "custom"];

const STATUS_STYLE: Record<Subscription["status"], string> = {
  active: "bg-success/15 text-success border-success/30",
  trial: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const emptyForm: SubscriptionInput = {
  vendor: "",
  cost: { amount: 0, currency: "USD" },
  billingCycle: "monthly",
  renewalDate: new Date().toISOString(),
  autoRenew: true,
};

function toEditForm(s: Subscription): SubscriptionInput {
  return {
    vendor: s.vendor,
    plan: s.plan,
    cost: { amount: s.cost.amount, currency: s.cost.currency },
    billingCycle: s.billingCycle,
    renewalDate: s.renewalDate,
    autoRenew: s.autoRenew,
    cardUsed: s.cardUsed,
    status: s.status,
    notes: s.notes,
  };
}

export default function Subscriptions() {
  const { user: me } = useAuth();
  const canManage = !!me?.companyRole && FINANCE_COMPANY_ROLES.includes(me.companyRole);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { run: runUndoable } = useUndoableAction();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<SubscriptionInput>(emptyForm);

  const [editing, setEditing] = useState<Subscription | null>(null);
  const [editForm, setEditForm] = useState<SubscriptionInput>(emptyForm);
  const [deleting, setDeleting] = useState<Subscription | null>(null);

  const { data: subscriptions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["subscriptions", { archived: archivedView }],
    queryFn: () => subscriptionsApi.list({ archived: archivedView }),
  });

  if (params.get("new") === "1" && canManage && !open) {
    setOpen(true);
    params.delete("new");
    setParams(params, { replace: true });
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["subscriptions"] });

  const createMutation = useMutation({
    mutationFn: subscriptionsApi.create,
    onSuccess: (sub) => { invalidate(); toast.success(`${sub.vendor} added`); setForm(emptyForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add subscription")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: SubscriptionInput) => subscriptionsApi.update(editing!.id, input),
    onSuccess: (sub) => { invalidate(); toast.success(`${sub.vendor} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update subscription")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => subscriptionsApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Subscription duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate subscription")),
  });

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    return subscriptions.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (!debouncedQuery) return true;
      return s.vendor.toLowerCase().includes(debouncedQuery.toLowerCase()) || (s.plan ?? "").toLowerCase().includes(debouncedQuery.toLowerCase());
    });
  }, [subscriptions, status, debouncedQuery]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendor.trim()) return toast.error("Vendor name is required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.vendor.trim()) return toast.error("Vendor name is required");
    updateMutation.mutate(editForm);
  };

  const openEdit = (s: Subscription) => {
    setEditing(s);
    setEditForm(toEditForm(s));
  };

  const doDelete = (sub: Subscription) => {
    qc.setQueryData<Subscription[]>(["subscriptions", { archived: archivedView }], (old) => old?.filter((s) => s.id !== sub.id));
    setDeleting(null);
    runUndoable({
      message: `${sub.vendor} deleted`,
      onCommit: () => subscriptionsApi.remove(sub.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const columns: DataTableColumn<Subscription>[] = [
    { key: "vendor", header: "Vendor", sortAccessor: (s) => s.vendor, exportAccessor: (s) => s.vendor, cell: (s) => <div className="font-medium">{s.vendor}</div> },
    { key: "plan", header: "Plan", exportAccessor: (s) => s.plan, cell: (s) => <span className="text-muted-foreground">{s.plan || "—"}</span> },
    { key: "cost", header: "Cost", sortAccessor: (s) => s.cost.amount, exportAccessor: (s) => s.cost.amount, cell: (s) => <span>${s.cost.amount.toLocaleString()}<span className="text-xs text-muted-foreground">/{s.billingCycle}</span></span> },
    {
      key: "status",
      header: "Status",
      sortAccessor: (s) => s.status,
      exportAccessor: (s) => s.status,
      cell: (s) => <Badge variant="outline" className={STATUS_STYLE[s.status]}>{s.status}</Badge>,
    },
    {
      key: "renewalDate",
      header: "Renews",
      sortAccessor: (s) => s.renewalDate,
      exportAccessor: (s) => format(new Date(s.renewalDate), "yyyy-MM-dd"),
      cell: (s) => <RenewalBadge date={s.renewalDate} />,
    },
  ];

  const rowActions = (): RowAction<Subscription>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => subscriptionsApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => subscriptionsApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            {subscriptions.length} tools tracked &middot; ~${subscriptions.reduce((s, x) => s + x.cost.amount, 0).toLocaleString()}/mo
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add subscription</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent" /> Add subscription</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input id="vendor" autoFocus value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Vercel" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="plan">Plan</Label>
                  <Input id="plan" value={form.plan ?? ""} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} placeholder="Pro" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cost">Cost ($)</Label>
                    <Input id="cost" type="number" min={0} step="0.01" value={form.cost.amount} onChange={(e) => setForm((f) => ({ ...f, cost: { ...f.cost, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label>Billing cycle</Label>
                    <Select value={form.billingCycle} onValueChange={(v) => setForm((f) => ({ ...f, billingCycle: v as BillingCycle }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{BILLING_CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="renewalDate">Renewal date</Label>
                  <Input id="renewalDate" type="date" value={form.renewalDate.slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, renewalDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding&hellip;</span> : "Add subscription"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getId={(s) => s.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={CreditCard}
        emptyTitle={subscriptions.length === 0 ? (archivedView ? "No archived subscriptions" : "No subscriptions yet") : "No matches"}
        emptyDescription="Track every SaaS tool the company pays for."
        exportFilenameBase="subscriptions"
        exportTitle="Subscriptions"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => subscriptionsApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => subscriptionsApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => subscriptionsApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} subscription(s) deleted`)) },
        ] : undefined}
        toolbarExtra={
          <>
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vendors" className="pl-9 bg-secondary/40 border-border/60" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <ArchivedToggle archived={archivedView} onChange={setArchivedView} />
          </>
        }
      />

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {editing.vendor}</DialogTitle></DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="edit-vendor">Vendor</Label>
                  <Input id="edit-vendor" autoFocus value={editForm.vendor} onChange={(e) => setEditForm((f) => ({ ...f, vendor: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="edit-plan">Plan</Label>
                  <Input id="edit-plan" value={editForm.plan ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-cost">Cost ($)</Label>
                    <Input id="edit-cost" type="number" min={0} step="0.01" value={editForm.cost.amount} onChange={(e) => setEditForm((f) => ({ ...f, cost: { ...f.cost, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label>Billing cycle</Label>
                    <Select value={editForm.billingCycle} onValueChange={(v) => setEditForm((f) => ({ ...f, billingCycle: v as BillingCycle }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{BILLING_CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-renewalDate">Renewal date</Label>
                    <Input id="edit-renewalDate" type="date" value={editForm.renewalDate.slice(0, 10)} onChange={(e) => setEditForm((f) => ({ ...f, renewalDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as Subscription["status"] }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="trial">Trial</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={updateMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {updateMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving&hellip;</span> : "Save changes"}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove ${deleting?.vendor ?? "this subscription"}?`}
        description="This permanently deletes the subscription record and its invoice, if any, after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}
