import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, ExternalLink, Globe2, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { domainsApi, type DomainInput } from "@/api/domains";
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
import { FINANCE_COMPANY_ROLES, type Domain } from "@/types";
import { format } from "date-fns";

const STATUS_STYLE: Record<Domain["status"], string> = {
  active: "bg-success/15 text-success border-success/30",
  expiring: "bg-warning/15 text-warning border-warning/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
};

const emptyForm: DomainInput = {
  domainName: "",
  registrar: "",
  dns: "",
  cost: { amount: 0, currency: "USD" },
  renewalDate: new Date().toISOString(),
  autoRenew: true,
};

function toEditForm(d: Domain): DomainInput {
  return {
    domainName: d.domainName,
    registrar: d.registrar,
    dns: d.dns,
    sslExpiry: d.sslExpiry,
    cost: { amount: d.cost.amount, currency: d.cost.currency },
    renewalDate: d.renewalDate,
    autoRenew: d.autoRenew,
    status: d.status,
    notes: d.notes,
  };
}

export default function Domains() {
  const { user: me } = useAuth();
  const canManage = !!me?.companyRole && FINANCE_COMPANY_ROLES.includes(me.companyRole);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { run: runUndoable } = useUndoableAction();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<DomainInput>(emptyForm);

  const [editing, setEditing] = useState<Domain | null>(null);
  const [editForm, setEditForm] = useState<DomainInput>(emptyForm);
  const [deleting, setDeleting] = useState<Domain | null>(null);

  const { data: domains = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["domains", { archived: archivedView }],
    queryFn: () => domainsApi.list({ archived: archivedView }),
  });

  if (params.get("new") === "1" && canManage && !open) {
    setOpen(true);
    params.delete("new");
    setParams(params, { replace: true });
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["domains"] });

  const createMutation = useMutation({
    mutationFn: domainsApi.create,
    onSuccess: (d) => { invalidate(); toast.success(`${d.domainName} added`); setForm(emptyForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add domain")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: DomainInput) => domainsApi.update(editing!.id, input),
    onSuccess: (d) => { invalidate(); toast.success(`${d.domainName} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update domain")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => domainsApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Domain duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate domain")),
  });

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    return domains.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!debouncedQuery) return true;
      return d.domainName.toLowerCase().includes(debouncedQuery.toLowerCase()) || d.registrar.toLowerCase().includes(debouncedQuery.toLowerCase());
    });
  }, [domains, status, debouncedQuery]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.domainName.trim() || !form.registrar.trim()) return toast.error("Domain name and registrar are required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.domainName.trim() || !editForm.registrar.trim()) return toast.error("Domain name and registrar are required");
    updateMutation.mutate(editForm);
  };

  const openEdit = (d: Domain) => {
    setEditing(d);
    setEditForm(toEditForm(d));
  };

  const doDelete = (domain: Domain) => {
    qc.setQueryData<Domain[]>(["domains", { archived: archivedView }], (old) => old?.filter((d) => d.id !== domain.id));
    setDeleting(null);
    runUndoable({
      message: `${domain.domainName} deleted`,
      onCommit: () => domainsApi.remove(domain.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const columns: DataTableColumn<Domain>[] = [
    {
      key: "domainName",
      header: "Domain",
      sortAccessor: (d) => d.domainName,
      exportAccessor: (d) => d.domainName,
      cell: (d) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{d.domainName}</span>
          <a href={`https://who.is/whois/${d.domainName}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary-glow" data-no-row-click>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ),
    },
    { key: "registrar", header: "Registrar", sortAccessor: (d) => d.registrar, exportAccessor: (d) => d.registrar, cell: (d) => d.registrar },
    { key: "cost", header: "Cost", sortAccessor: (d) => d.cost.amount, exportAccessor: (d) => d.cost.amount, cell: (d) => <span>${d.cost.amount.toLocaleString()}/yr</span> },
    { key: "status", header: "Status", sortAccessor: (d) => d.status, exportAccessor: (d) => d.status, cell: (d) => <Badge variant="outline" className={STATUS_STYLE[d.status]}>{d.status}</Badge> },
    {
      key: "renewalDate",
      header: "Renews",
      sortAccessor: (d) => d.renewalDate,
      exportAccessor: (d) => format(new Date(d.renewalDate), "yyyy-MM-dd"),
      cell: (d) => <RenewalBadge date={d.renewalDate} />,
    },
    {
      key: "sslExpiry",
      header: "SSL",
      exportAccessor: (d) => (d.sslExpiry ? format(new Date(d.sslExpiry), "yyyy-MM-dd") : ""),
      cell: (d) => d.sslExpiry ? <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {format(new Date(d.sslExpiry), "MMM d, yyyy")}</span> : <span className="text-muted-foreground">—</span>,
    },
  ];

  const rowActions = (): RowAction<Domain>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => domainsApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => domainsApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Domain Manager</h1>
          <p className="text-muted-foreground mt-1">{domains.length} domains tracked.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add domain</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-accent" /> Add domain</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="domainName">Domain name</Label>
                  <Input id="domainName" autoFocus value={form.domainName} onChange={(e) => setForm((f) => ({ ...f, domainName: e.target.value }))} placeholder="ethixweb.com" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="registrar">Registrar</Label>
                  <Input id="registrar" value={form.registrar} onChange={(e) => setForm((f) => ({ ...f, registrar: e.target.value }))} placeholder="GoDaddy" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="dns">DNS / nameservers (optional)</Label>
                  <Input id="dns" value={form.dns ?? ""} onChange={(e) => setForm((f) => ({ ...f, dns: e.target.value }))} placeholder="ns1.example.com" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cost">Cost ($)</Label>
                    <Input id="cost" type="number" min={0} step="0.01" value={form.cost.amount} onChange={(e) => setForm((f) => ({ ...f, cost: { ...f.cost, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label htmlFor="renewalDate">Renewal date</Label>
                    <Input id="renewalDate" type="date" value={form.renewalDate.slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, renewalDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="sslExpiry">SSL expiry (optional)</Label>
                  <Input id="sslExpiry" type="date" onChange={(e) => setForm((f) => ({ ...f, sslExpiry: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding&hellip;</span> : "Add domain"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getId={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Globe2}
        emptyTitle={domains.length === 0 ? (archivedView ? "No archived domains" : "No domains yet") : "No matches"}
        exportFilenameBase="domains"
        exportTitle="Domains"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => domainsApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => domainsApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => domainsApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} domain(s) deleted`)) },
        ] : undefined}
        toolbarExtra={
          <>
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search domains" className="pl-9 bg-secondary/40 border-border/60" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring">Expiring</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
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
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {editing.domainName}</DialogTitle></DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="edit-domainName">Domain name</Label>
                  <Input id="edit-domainName" autoFocus value={editForm.domainName} onChange={(e) => setEditForm((f) => ({ ...f, domainName: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="edit-registrar">Registrar</Label>
                  <Input id="edit-registrar" value={editForm.registrar} onChange={(e) => setEditForm((f) => ({ ...f, registrar: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="edit-dns">DNS / nameservers</Label>
                  <Input id="edit-dns" value={editForm.dns ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, dns: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-cost">Cost ($)</Label>
                    <Input id="edit-cost" type="number" min={0} step="0.01" value={editForm.cost.amount} onChange={(e) => setEditForm((f) => ({ ...f, cost: { ...f.cost, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label htmlFor="edit-renewalDate">Renewal date</Label>
                    <Input id="edit-renewalDate" type="date" value={editForm.renewalDate.slice(0, 10)} onChange={(e) => setEditForm((f) => ({ ...f, renewalDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-sslExpiry">SSL expiry</Label>
                    <Input id="edit-sslExpiry" type="date" value={editForm.sslExpiry ? editForm.sslExpiry.slice(0, 10) : ""} onChange={(e) => setEditForm((f) => ({ ...f, sslExpiry: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as Domain["status"] }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="expiring">Expiring</SelectItem><SelectItem value="expired">Expired</SelectItem></SelectContent>
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
        title={`Remove ${deleting?.domainName ?? "this domain"}?`}
        description="This permanently deletes the domain record after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}
