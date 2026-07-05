import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Briefcase, Copy, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi, type ClientInput } from "@/api/clients";
import { useHasPermission } from "@/hooks/usePermission";
import { useDebounce } from "@/hooks/useDebounce";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { PortalAccessDialog } from "@/components/PortalAccessDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArchivedToggle } from "@/components/ArchivedToggle";
import { DataTable, type DataTableColumn, type RowAction } from "@/components/DataTable";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import type { Client, ClientStatus } from "@/types";

const STATUSES: ClientStatus[] = ["active", "inactive", "prospect"];
const STATUS_STYLE: Record<ClientStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  prospect: "bg-warning/15 text-warning border-warning/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

const emptyForm: ClientInput = { name: "", status: "active", contractValue: { amount: 0, currency: "USD" } };

function toEditForm(c: Client): ClientInput {
  return {
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    address: c.address,
    status: c.status,
    contractValue: { amount: c.contractValue.amount, currency: c.contractValue.currency },
    notes: c.notes,
  };
}

export default function Clients() {
  const canManage = useHasPermission('clients.manage');
  const qc = useQueryClient();
  const { run: runUndoable } = useUndoableAction();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<ClientInput>(emptyForm);
  const [editing, setEditing] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState<ClientInput>(emptyForm);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [portalAccessForId, setPortalAccessForId] = useState<string | null>(null);

  const { data: clients = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["clients", { archived: archivedView }],
    queryFn: () => clientsApi.list({ archived: archivedView }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["clients"] });

  const createMutation = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: (c) => { invalidate(); toast.success(`${c.name} added`); setForm(emptyForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add client")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: ClientInput) => clientsApi.update(editing!.id, input),
    onSuccess: (c) => { invalidate(); toast.success(`${c.name} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update client")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => clientsApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Client duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate client")),
  });

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!debouncedQuery) return true;
      const q = debouncedQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    });
  }, [clients, status, debouncedQuery]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Client name is required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return toast.error("Client name is required");
    updateMutation.mutate(editForm);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setEditForm(toEditForm(c));
  };

  const doDelete = (client: Client) => {
    qc.setQueryData<Client[]>(["clients", { archived: archivedView }], (old) => old?.filter((c) => c.id !== client.id));
    setDeleting(null);
    runUndoable({
      message: `${client.name} deleted`,
      onCommit: () => clientsApi.remove(client.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const renderFormFields = (f: ClientInput, setF: (updater: (prev: ClientInput) => ClientInput) => void, idPrefix: string) => (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Contact name</Label>
        <Input id={`${idPrefix}-name`} autoFocus value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="Jordan Lee" className="mt-1.5 bg-secondary/40 border-border/60" />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-company`}>Company</Label>
        <Input id={`${idPrefix}-company`} value={f.company ?? ""} onChange={(e) => setF((p) => ({ ...p, company: e.target.value }))} placeholder="Acme Corp" className="mt-1.5 bg-secondary/40 border-border/60" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-email`}>Email</Label>
          <Input id={`${idPrefix}-email`} type="email" value={f.email ?? ""} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
          <Input id={`${idPrefix}-phone`} value={f.phone ?? ""} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-contract`}>Contract value ($)</Label>
          <Input id={`${idPrefix}-contract`} type="number" min={0} step="0.01" value={f.contractValue?.amount ?? 0} onChange={(e) => setF((p) => ({ ...p, contractValue: { ...p.contractValue, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF((p) => ({ ...p, status: v as ClientStatus }))}>
            <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea id={`${idPrefix}-notes`} value={f.notes ?? ""} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" rows={2} />
      </div>
    </>
  );

  const columns: DataTableColumn<Client>[] = [
    { key: "name", header: "Contact", sortAccessor: (c) => c.name, exportAccessor: (c) => c.name, cell: (c) => <div className="font-medium">{c.name}</div> },
    { key: "company", header: "Company", sortAccessor: (c) => c.company, exportAccessor: (c) => c.company, cell: (c) => <span className="text-muted-foreground">{c.company || "—"}</span> },
    { key: "email", header: "Email", exportAccessor: (c) => c.email, cell: (c) => <span className="text-muted-foreground">{c.email || "—"}</span> },
    { key: "contractValue", header: "Contract", sortAccessor: (c) => c.contractValue.amount, exportAccessor: (c) => c.contractValue.amount, cell: (c) => <span>${c.contractValue.amount.toLocaleString()}</span> },
    { key: "status", header: "Status", sortAccessor: (c) => c.status, exportAccessor: (c) => c.status, cell: (c) => <Badge variant="outline" className={STATUS_STYLE[c.status]}>{c.status}</Badge> },
  ];

  const rowActions = (): RowAction<Client>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
        { label: "Portal access", icon: ShieldCheck, onClick: (r) => setPortalAccessForId(r.id), hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => clientsApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => clientsApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {clients.length} clients &middot; ${clients.reduce((s, c) => s + c.contractValue.amount, 0).toLocaleString()} in contract value
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add client</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-accent" /> Add client</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                {renderFormFields(form, setForm, "new")}
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding&hellip;</span> : "Add client"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getId={(c) => c.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Briefcase}
        emptyTitle={clients.length === 0 ? (archivedView ? "No archived clients" : "No clients yet") : "No matches"}
        emptyDescription="Track every customer relationship in one place."
        exportFilenameBase="clients"
        exportTitle="Clients"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => clientsApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => clientsApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => clientsApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} client(s) deleted`)) },
        ] : undefined}
        toolbarExtra={
          <>
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" className="pl-9 bg-secondary/40 border-border/60" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {editing.name}</DialogTitle></DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                {renderFormFields(editForm, setEditForm, "edit")}
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
        title={`Remove ${deleting?.name ?? "this client"}?`}
        description="This permanently deletes the client record after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />

      <PortalAccessDialog
        type="client"
        record={clients.find((c) => c.id === portalAccessForId) ?? null}
        onOpenChange={(open) => !open && setPortalAccessForId(null)}
        invalidateKey="clients"
      />
    </div>
  );
}
