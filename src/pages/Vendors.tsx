import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Copy, Loader2, Pencil, Plus, Search, ShieldCheck, Store, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorsApi, type VendorInput } from "@/api/vendors";
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
import type { Vendor, VendorStatus } from "@/types";

const STATUSES: VendorStatus[] = ["active", "inactive"];
const STATUS_STYLE: Record<VendorStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

const emptyForm: VendorInput = { name: "", status: "active", contractValue: { amount: 0, currency: "USD" } };

function toEditForm(v: Vendor): VendorInput {
  return {
    name: v.name,
    category: v.category,
    contactName: v.contactName,
    email: v.email,
    phone: v.phone,
    address: v.address,
    status: v.status,
    contractValue: { amount: v.contractValue.amount, currency: v.contractValue.currency },
    notes: v.notes,
  };
}

export default function Vendors() {
  const canManage = useHasPermission('vendors.manage');
  const qc = useQueryClient();
  const { run: runUndoable } = useUndoableAction();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<VendorInput>(emptyForm);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState<VendorInput>(emptyForm);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [portalAccessForId, setPortalAccessForId] = useState<string | null>(null);

  const { data: vendors = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["vendors", { archived: archivedView }],
    queryFn: () => vendorsApi.list({ archived: archivedView }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendors"] });

  const createMutation = useMutation({
    mutationFn: vendorsApi.create,
    onSuccess: (v) => { invalidate(); toast.success(`${v.name} added`); setForm(emptyForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add vendor")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: VendorInput) => vendorsApi.update(editing!.id, input),
    onSuccess: (v) => { invalidate(); toast.success(`${v.name} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update vendor")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => vendorsApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Vendor duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate vendor")),
  });

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (!debouncedQuery) return true;
      const q = debouncedQuery.toLowerCase();
      return v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q) || v.email.toLowerCase().includes(q);
    });
  }, [vendors, status, debouncedQuery]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Vendor name is required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return toast.error("Vendor name is required");
    updateMutation.mutate(editForm);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setEditForm(toEditForm(v));
  };

  const doDelete = (vendor: Vendor) => {
    qc.setQueryData<Vendor[]>(["vendors", { archived: archivedView }], (old) => old?.filter((v) => v.id !== vendor.id));
    setDeleting(null);
    runUndoable({
      message: `${vendor.name} deleted`,
      onCommit: () => vendorsApi.remove(vendor.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const renderFormFields = (f: VendorInput, setF: (updater: (prev: VendorInput) => VendorInput) => void, idPrefix: string) => (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Vendor name</Label>
        <Input id={`${idPrefix}-name`} autoFocus value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="AWS" className="mt-1.5 bg-secondary/40 border-border/60" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-category`}>Category</Label>
          <Input id={`${idPrefix}-category`} value={f.category ?? ""} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} placeholder="Infrastructure" className="mt-1.5 bg-secondary/40 border-border/60" />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-contact`}>Contact name</Label>
          <Input id={`${idPrefix}-contact`} value={f.contactName ?? ""} onChange={(e) => setF((p) => ({ ...p, contactName: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
        </div>
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
          <Select value={f.status} onValueChange={(v) => setF((p) => ({ ...p, status: v as VendorStatus }))}>
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

  const columns: DataTableColumn<Vendor>[] = [
    { key: "name", header: "Vendor", sortAccessor: (v) => v.name, exportAccessor: (v) => v.name, cell: (v) => <div className="font-medium">{v.name}</div> },
    { key: "category", header: "Category", sortAccessor: (v) => v.category, exportAccessor: (v) => v.category, cell: (v) => <span className="text-muted-foreground">{v.category || "—"}</span> },
    { key: "email", header: "Email", exportAccessor: (v) => v.email, cell: (v) => <span className="text-muted-foreground">{v.email || "—"}</span> },
    { key: "contractValue", header: "Contract", sortAccessor: (v) => v.contractValue.amount, exportAccessor: (v) => v.contractValue.amount, cell: (v) => <span>${v.contractValue.amount.toLocaleString()}</span> },
    { key: "status", header: "Status", sortAccessor: (v) => v.status, exportAccessor: (v) => v.status, cell: (v) => <Badge variant="outline" className={STATUS_STYLE[v.status]}>{v.status}</Badge> },
  ];

  const rowActions = (): RowAction<Vendor>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
        { label: "Portal access", icon: ShieldCheck, onClick: (r) => setPortalAccessForId(r.id), hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => vendorsApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => vendorsApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground mt-1">
            {vendors.length} vendors &middot; ${vendors.reduce((s, v) => s + v.contractValue.amount, 0).toLocaleString()} in contracts
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add vendor</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Store className="h-4 w-4 text-accent" /> Add vendor</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                {renderFormFields(form, setForm, "new")}
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding&hellip;</span> : "Add vendor"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getId={(v) => v.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Store}
        emptyTitle={vendors.length === 0 ? (archivedView ? "No archived vendors" : "No vendors yet") : "No matches"}
        emptyDescription="Track every supplier and service provider."
        exportFilenameBase="vendors"
        exportTitle="Vendors"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => vendorsApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => vendorsApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => vendorsApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} vendor(s) deleted`)) },
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
        title={`Remove ${deleting?.name ?? "this vendor"}?`}
        description="This permanently deletes the vendor record after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />

      <PortalAccessDialog
        type="vendor"
        record={vendors.find((v) => v.id === portalAccessForId) ?? null}
        onOpenChange={(open) => !open && setPortalAccessForId(null)}
        invalidateKey="vendors"
      />
    </div>
  );
}
