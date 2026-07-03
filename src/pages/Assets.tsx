import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Copy, Laptop, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsApi, type AssetInput } from "@/api/assets";
import { useAuth } from "@/context/AuthContext";
import { useEmployees } from "@/hooks/useEmployees";
import { useDebounce } from "@/hooks/useDebounce";
import { useUndoableAction } from "@/hooks/useUndoableAction";
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
import { ASSET_COMPANY_ROLES, type AssetCategory, type AssetRecord, type AssetStatus } from "@/types";

const CATEGORIES: AssetCategory[] = ["Laptop", "Desktop", "Monitor", "Phone", "Software License", "Furniture", "Networking", "Other"];
const STATUSES: AssetStatus[] = ["available", "in_use", "maintenance", "retired"];

const STATUS_STYLE: Record<AssetStatus, string> = {
  available: "bg-success/15 text-success border-success/30",
  in_use: "bg-primary/15 text-primary-glow border-primary/30",
  maintenance: "bg-warning/15 text-warning border-warning/30",
  retired: "bg-muted text-muted-foreground border-border",
};

const emptyForm: AssetInput = {
  label: "",
  category: "Other",
  cost: { amount: 0, currency: "USD" },
  status: "available",
};

function toEditForm(a: AssetRecord): AssetInput {
  return {
    label: a.label,
    category: a.category,
    serialNumber: a.serialNumber,
    vendor: a.vendor,
    purchaseDate: a.purchaseDate,
    warrantyExpiry: a.warrantyExpiry,
    cost: { amount: a.cost.amount, currency: a.cost.currency },
    assignedTo: a.assignedTo?.id ?? null,
    status: a.status,
    notes: a.notes,
  };
}

export default function Assets() {
  const { user: me } = useAuth();
  const canManage = !!me?.companyRole && ASSET_COMPANY_ROLES.includes(me.companyRole);
  const qc = useQueryClient();
  const { employees } = useEmployees();
  const { run: runUndoable } = useUndoableAction();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<AssetInput>(emptyForm);

  const [editing, setEditing] = useState<AssetRecord | null>(null);
  const [editForm, setEditForm] = useState<AssetInput>(emptyForm);
  const [deleting, setDeleting] = useState<AssetRecord | null>(null);

  const { data: assets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["assets", { archived: archivedView }],
    queryFn: () => assetsApi.list({ archived: archivedView }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets"] });

  const createMutation = useMutation({
    mutationFn: assetsApi.create,
    onSuccess: (a) => { invalidate(); toast.success(`${a.label} added`); setForm(emptyForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add asset")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: AssetInput) => assetsApi.update(editing!.id, input),
    onSuccess: (a) => { invalidate(); toast.success(`${a.label} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update asset")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => assetsApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Asset duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate asset")),
  });

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (!debouncedQuery) return true;
      const q = debouncedQuery.toLowerCase();
      return a.label.toLowerCase().includes(q) || a.serialNumber.toLowerCase().includes(q) || a.vendor.toLowerCase().includes(q);
    });
  }, [assets, status, debouncedQuery]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) return toast.error("Asset name is required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.label.trim()) return toast.error("Asset name is required");
    updateMutation.mutate(editForm);
  };

  const openEdit = (a: AssetRecord) => {
    setEditing(a);
    setEditForm(toEditForm(a));
  };

  const doDelete = (asset: AssetRecord) => {
    qc.setQueryData<AssetRecord[]>(["assets", { archived: archivedView }], (old) => old?.filter((a) => a.id !== asset.id));
    setDeleting(null);
    runUndoable({
      message: `${asset.label} deleted`,
      onCommit: () => assetsApi.remove(asset.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const renderFormFields = (f: AssetInput, setF: (updater: (prev: AssetInput) => AssetInput) => void, idPrefix: string) => (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-label`}>Asset name</Label>
        <Input id={`${idPrefix}-label`} autoFocus value={f.label} onChange={(e) => setF((p) => ({ ...p, label: e.target.value }))} placeholder="MacBook Pro 16&quot;" className="mt-1.5 bg-secondary/40 border-border/60" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={f.category} onValueChange={(v) => setF((p) => ({ ...p, category: v as AssetCategory }))}>
            <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF((p) => ({ ...p, status: v as AssetStatus }))}>
            <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-serial`}>Serial number</Label>
          <Input id={`${idPrefix}-serial`} value={f.serialNumber ?? ""} onChange={(e) => setF((p) => ({ ...p, serialNumber: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-cost`}>Cost ($)</Label>
          <Input id={`${idPrefix}-cost`} type="number" min={0} step="0.01" value={f.cost?.amount ?? 0} onChange={(e) => setF((p) => ({ ...p, cost: { ...p.cost, amount: Number(e.target.value) } }))} className="mt-1.5 bg-secondary/40 border-border/60" />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-vendor`}>Vendor</Label>
        <Input id={`${idPrefix}-vendor`} value={f.vendor ?? ""} onChange={(e) => setF((p) => ({ ...p, vendor: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
      </div>
      <div>
        <Label>Assigned to</Label>
        <Select value={f.assignedTo ?? "none"} onValueChange={(v) => setF((p) => ({ ...p, assignedTo: v === "none" ? null : v }))}>
          <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea id={`${idPrefix}-notes`} value={f.notes ?? ""} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" rows={2} />
      </div>
    </>
  );

  const columns: DataTableColumn<AssetRecord>[] = [
    { key: "label", header: "Asset", sortAccessor: (a) => a.label, exportAccessor: (a) => a.label, cell: (a) => <div><div className="font-medium">{a.label}</div><div className="text-xs text-muted-foreground">{a.serialNumber || "—"}</div></div> },
    { key: "category", header: "Category", sortAccessor: (a) => a.category, exportAccessor: (a) => a.category, cell: (a) => a.category },
    { key: "cost", header: "Cost", sortAccessor: (a) => a.cost.amount, exportAccessor: (a) => a.cost.amount, cell: (a) => <span>${a.cost.amount.toLocaleString()}</span> },
    { key: "status", header: "Status", sortAccessor: (a) => a.status, exportAccessor: (a) => a.status, cell: (a) => <Badge variant="outline" className={STATUS_STYLE[a.status]}>{a.status.replace("_", " ")}</Badge> },
    { key: "assignedTo", header: "Assigned to", sortAccessor: (a) => a.assignedTo?.name ?? "", exportAccessor: (a) => a.assignedTo?.name ?? "Unassigned", cell: (a) => <span className="text-muted-foreground">{a.assignedTo?.name ?? "Unassigned"}</span> },
  ];

  const rowActions = (): RowAction<AssetRecord>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => assetsApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => assetsApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground mt-1">
            {assets.length} assets tracked &middot; ${assets.reduce((s, x) => s + x.cost.amount, 0).toLocaleString()} total value
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add asset</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Laptop className="h-4 w-4 text-accent" /> Add asset</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                {renderFormFields(form, setForm, "new")}
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding&hellip;</span> : "Add asset"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getId={(a) => a.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Laptop}
        emptyTitle={assets.length === 0 ? (archivedView ? "No archived assets" : "No assets yet") : "No matches"}
        emptyDescription="Track laptops, licenses, and equipment across the company."
        exportFilenameBase="assets"
        exportTitle="Assets"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => assetsApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => assetsApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => assetsApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} asset(s) deleted`)) },
        ] : undefined}
        toolbarExtra={
          <>
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assets" className="pl-9 bg-secondary/40 border-border/60" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
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
        title={`Remove ${deleting?.label ?? "this asset"}?`}
        description="This permanently deletes the asset record after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}
