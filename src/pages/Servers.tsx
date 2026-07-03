import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Copy, Loader2, Pencil, Plus, Search, Server as ServerIcon, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serversApi, type ServerInput } from "@/api/servers";
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
import { FINANCE_COMPANY_ROLES, type ServerAsset, type ServerProvider } from "@/types";
import { format } from "date-fns";

const PROVIDERS: ServerProvider[] = ["Railway", "Vercel", "Render", "AWS", "Azure", "GCP", "DigitalOcean", "VPS", "Other"];
const STATUSES: ServerAsset["status"][] = ["online", "degraded", "offline"];

const STATUS_STYLE: Record<ServerAsset["status"], string> = {
  online: "bg-success/15 text-success border-success/30",
  degraded: "bg-warning/15 text-warning border-warning/30",
  offline: "bg-destructive/15 text-destructive border-destructive/30",
};

const emptyForm: ServerInput = {
  label: "",
  provider: "Railway",
  cost: { amount: 0, currency: "USD" },
  renewalDate: new Date().toISOString(),
  storage: { used: 0, total: 10, unit: "GB" },
  bandwidth: { used: 0, total: 100, unit: "GB" },
};

function toEditForm(s: ServerAsset): ServerInput {
  return {
    label: s.label,
    provider: s.provider,
    hostingType: s.hostingType,
    storage: { ...s.storage },
    bandwidth: { ...s.bandwidth },
    cost: { amount: s.cost.amount, currency: s.cost.currency },
    renewalDate: s.renewalDate,
    status: s.status,
    notes: s.notes,
  };
}

function UsageBar({ used, total, unit }: { used: number; total: number; unit: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="w-28">
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground mb-0.5">
        <span>{used}/{total} {unit}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-primary"
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

export default function Servers() {
  const { user: me } = useAuth();
  const canManage = !!me?.companyRole && FINANCE_COMPANY_ROLES.includes(me.companyRole);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { run: runUndoable } = useUndoableAction();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<ServerInput>(emptyForm);

  const [editing, setEditing] = useState<ServerAsset | null>(null);
  const [editForm, setEditForm] = useState<ServerInput>(emptyForm);
  const [deleting, setDeleting] = useState<ServerAsset | null>(null);

  const { data: servers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["servers", { archived: archivedView }],
    queryFn: () => serversApi.list({ archived: archivedView }),
  });

  if (params.get("new") === "1" && canManage && !open) {
    setOpen(true);
    params.delete("new");
    setParams(params, { replace: true });
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["servers"] });

  const createMutation = useMutation({
    mutationFn: serversApi.create,
    onSuccess: (s) => { invalidate(); toast.success(`${s.label} added`); setForm(emptyForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add server")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: ServerInput) => serversApi.update(editing!.id, input),
    onSuccess: (s) => { invalidate(); toast.success(`${s.label} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update server")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => serversApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Server duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate server")),
  });

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    return servers.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (!debouncedQuery) return true;
      return s.label.toLowerCase().includes(debouncedQuery.toLowerCase());
    });
  }, [servers, status, debouncedQuery]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return toast.error("Label is required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.label.trim()) return toast.error("Label is required");
    updateMutation.mutate(editForm);
  };

  const openEdit = (s: ServerAsset) => {
    setEditing(s);
    setEditForm(toEditForm(s));
  };

  const doDelete = (server: ServerAsset) => {
    qc.setQueryData<ServerAsset[]>(["servers", { archived: archivedView }], (old) => old?.filter((s) => s.id !== server.id));
    setDeleting(null);
    runUndoable({
      message: `${server.label} deleted`,
      onCommit: () => serversApi.remove(server.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const columns: DataTableColumn<ServerAsset>[] = [
    { key: "label", header: "Label", sortAccessor: (s) => s.label, exportAccessor: (s) => s.label, cell: (s) => <div className="font-medium">{s.label}</div> },
    { key: "provider", header: "Provider", sortAccessor: (s) => s.provider, exportAccessor: (s) => s.provider, cell: (s) => s.provider },
    { key: "storage", header: "Storage", exportAccessor: (s) => `${s.storage.used}/${s.storage.total}${s.storage.unit}`, cell: (s) => <UsageBar {...s.storage} /> },
    { key: "bandwidth", header: "Bandwidth", exportAccessor: (s) => `${s.bandwidth.used}/${s.bandwidth.total}${s.bandwidth.unit}`, cell: (s) => <UsageBar {...s.bandwidth} /> },
    { key: "cost", header: "Cost", sortAccessor: (s) => s.cost.amount, exportAccessor: (s) => s.cost.amount, cell: (s) => <span>${s.cost.amount.toLocaleString()}/mo</span> },
    { key: "status", header: "Status", sortAccessor: (s) => s.status, exportAccessor: (s) => s.status, cell: (s) => <Badge variant="outline" className={STATUS_STYLE[s.status]}>{s.status}</Badge> },
    {
      key: "renewalDate",
      header: "Renews",
      sortAccessor: (s) => s.renewalDate,
      exportAccessor: (s) => format(new Date(s.renewalDate), "yyyy-MM-dd"),
      cell: (s) => <RenewalBadge date={s.renewalDate} />,
    },
  ];

  const rowActions = (): RowAction<ServerAsset>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => serversApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => serversApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Server Manager</h1>
          <p className="text-muted-foreground mt-1">{servers.length} servers &amp; hosts tracked.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add server</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><ServerIcon className="h-4 w-4 text-accent" /> Add server</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" autoFocus value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Production API" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label>Provider</Label>
                  <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v as ServerProvider }))}>
                    <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cost">Cost ($/mo)</Label>
                    <Input id="cost" type="number" min={0} step="0.01" value={form.cost.amount} onChange={(e) => setForm((f) => ({ ...f, cost: { ...f.cost, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label htmlFor="renewalDate">Renewal date</Label>
                    <Input id="renewalDate" type="date" value={form.renewalDate.slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, renewalDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding&hellip;</span> : "Add server"}
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
        emptyIcon={ServerIcon}
        emptyTitle={servers.length === 0 ? (archivedView ? "No archived servers" : "No servers yet") : "No matches"}
        exportFilenameBase="servers"
        exportTitle="Servers"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => serversApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => serversApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => serversApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} server(s) deleted`)) },
        ] : undefined}
        toolbarExtra={
          <>
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search servers" className="pl-9 bg-secondary/40 border-border/60" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
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
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {editing.label}</DialogTitle></DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="edit-label">Label</Label>
                  <Input id="edit-label" autoFocus value={editForm.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Provider</Label>
                    <Select value={editForm.provider} onValueChange={(v) => setEditForm((f) => ({ ...f, provider: v as ServerProvider }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as ServerAsset["status"] }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-cost">Cost ($/mo)</Label>
                    <Input id="edit-cost" type="number" min={0} step="0.01" value={editForm.cost.amount} onChange={(e) => setEditForm((f) => ({ ...f, cost: { ...f.cost, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label htmlFor="edit-renewalDate">Renewal date</Label>
                    <Input id="edit-renewalDate" type="date" value={editForm.renewalDate.slice(0, 10)} onChange={(e) => setEditForm((f) => ({ ...f, renewalDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Storage (GB)</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <Input type="number" min={0} value={editForm.storage?.used ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, storage: { used: Number(e.target.value), total: f.storage?.total ?? 10, unit: "GB" } }))} placeholder="Used" className="bg-secondary/40 border-border/60" />
                    <Input type="number" min={0} value={editForm.storage?.total ?? 10} onChange={(e) => setEditForm((f) => ({ ...f, storage: { used: f.storage?.used ?? 0, total: Number(e.target.value), unit: "GB" } }))} placeholder="Total" className="bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bandwidth (GB)</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <Input type="number" min={0} value={editForm.bandwidth?.used ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, bandwidth: { used: Number(e.target.value), total: f.bandwidth?.total ?? 100, unit: "GB" } }))} placeholder="Used" className="bg-secondary/40 border-border/60" />
                    <Input type="number" min={0} value={editForm.bandwidth?.total ?? 100} onChange={(e) => setEditForm((f) => ({ ...f, bandwidth: { used: f.bandwidth?.used ?? 0, total: Number(e.target.value), unit: "GB" } }))} placeholder="Total" className="bg-secondary/40 border-border/60" />
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
        title={`Remove ${deleting?.label ?? "this server"}?`}
        description="This permanently deletes the server record after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}
