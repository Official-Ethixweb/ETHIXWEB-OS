import { useState } from "react";
import { Archive, ArchiveRestore, Building2, Copy, Loader2, Pencil, Plus, Trash2, Users2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { departmentsApi, type DepartmentInput } from "@/api/departments";
import { teamsApi, type TeamInput } from "@/api/teams";
import { useAuth } from "@/context/AuthContext";
import { useEmployees } from "@/hooks/useEmployees";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArchivedToggle } from "@/components/ArchivedToggle";
import { DataTable, type DataTableColumn, type RowAction } from "@/components/DataTable";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { HR_COMPANY_ROLES, type DepartmentRecord, type Team } from "@/types";

const emptyDeptForm: DepartmentInput = { name: "", color: "#6366F1" };
const emptyTeamForm: TeamInput = { name: "", members: [] };

function DepartmentsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { employees } = useEmployees();
  const { run: runUndoable } = useUndoableAction();
  const [open, setOpen] = useState(false);
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<DepartmentInput>(emptyDeptForm);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [editForm, setEditForm] = useState<DepartmentInput>(emptyDeptForm);
  const [deleting, setDeleting] = useState<DepartmentRecord | null>(null);

  const { data: departments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["departments", { archived: archivedView }],
    queryFn: () => departmentsApi.list({ archived: archivedView }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["departments"] });

  const createMutation = useMutation({
    mutationFn: departmentsApi.create,
    onSuccess: (d) => { invalidate(); toast.success(`${d.name} created`); setForm(emptyDeptForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not create department")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: DepartmentInput) => departmentsApi.update(editing!.id, input),
    onSuccess: (d) => { invalidate(); toast.success(`${d.name} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update department")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Department duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate department")),
  });

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Department name is required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return toast.error("Department name is required");
    updateMutation.mutate(editForm);
  };

  const doDelete = (dept: DepartmentRecord) => {
    qc.setQueryData<DepartmentRecord[]>(["departments", { archived: archivedView }], (old) => old?.filter((d) => d.id !== dept.id));
    setDeleting(null);
    runUndoable({
      message: `${dept.name} deleted`,
      onCommit: () => departmentsApi.remove(dept.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const renderFields = (f: DepartmentInput, setF: (u: (p: DepartmentInput) => DepartmentInput) => void, idPrefix: string) => (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Department name</Label>
        <Input id={`${idPrefix}-name`} autoFocus value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="Customer Success" className="mt-1.5 bg-secondary/40 border-border/60" />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <Textarea id={`${idPrefix}-desc`} value={f.description ?? ""} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" rows={2} />
      </div>
      <div>
        <Label>Manager</Label>
        <Select value={f.manager ?? "none"} onValueChange={(v) => setF((p) => ({ ...p, manager: v === "none" ? null : v }))}>
          <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const columns: DataTableColumn<DepartmentRecord>[] = [
    {
      key: "name",
      header: "Department",
      sortAccessor: (d) => d.name,
      exportAccessor: (d) => d.name,
      cell: (d) => (
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
          <span className="font-medium">{d.name}</span>
        </div>
      ),
    },
    { key: "description", header: "Description", exportAccessor: (d) => d.description, cell: (d) => <span className="text-muted-foreground line-clamp-1">{d.description || "—"}</span> },
    { key: "manager", header: "Manager", sortAccessor: (d) => d.manager?.name ?? "", exportAccessor: (d) => d.manager?.name ?? "Unassigned", cell: (d) => <span className="text-muted-foreground">{d.manager?.name ?? "Unassigned"}</span> },
  ];

  const rowActions = (): RowAction<DepartmentRecord>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: (d) => { setEditing(d); setEditForm({ name: d.name, description: d.description, manager: d.manager?.id ?? null, color: d.color }); }, hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => departmentsApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => departmentsApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add department</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /> Add department</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                {renderFields(form, setForm, "new")}
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Creating&hellip;</span> : "Create department"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={departments}
        getId={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Building2}
        emptyTitle={archivedView ? "No archived departments" : "No departments yet"}
        emptyDescription="Set up your org structure to organize teams and reporting lines."
        exportFilenameBase="departments"
        exportTitle="Departments"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => departmentsApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => departmentsApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => departmentsApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} department(s) deleted`)) },
        ] : undefined}
        toolbarExtra={<ArchivedToggle archived={archivedView} onChange={setArchivedView} />}
      />

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="glass-strong border-border/60 max-w-md">
          {editing && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {editing.name}</DialogTitle></DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                {renderFields(editForm, setEditForm, "edit")}
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
        title={`Remove ${deleting?.name ?? "this department"}?`}
        description="This permanently deletes the department record after a few seconds (undo from the toast). Teams linked to it will be unlinked, not deleted."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}

function TeamsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { employees } = useEmployees();
  const { run: runUndoable } = useUndoableAction();
  const { data: departments = [] } = useQuery({ queryKey: ["departments", { archived: false }], queryFn: () => departmentsApi.list({ archived: false }) });
  const [open, setOpen] = useState(false);
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<TeamInput>(emptyTeamForm);
  const [editing, setEditing] = useState<Team | null>(null);
  const [editForm, setEditForm] = useState<TeamInput>(emptyTeamForm);
  const [deleting, setDeleting] = useState<Team | null>(null);

  const { data: teams = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["teams", { archived: archivedView }],
    queryFn: () => teamsApi.list({ archived: archivedView }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["teams"] });

  const createMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: (t) => { invalidate(); toast.success(`${t.name} created`); setForm(emptyTeamForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not create team")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: TeamInput) => teamsApi.update(editing!.id, input),
    onSuccess: (t) => { invalidate(); toast.success(`${t.name} updated`); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update team")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => teamsApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Team duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate team")),
  });

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Team name is required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return toast.error("Team name is required");
    updateMutation.mutate(editForm);
  };

  const doDelete = (team: Team) => {
    qc.setQueryData<Team[]>(["teams", { archived: archivedView }], (old) => old?.filter((t) => t.id !== team.id));
    setDeleting(null);
    runUndoable({
      message: `${team.name} deleted`,
      onCommit: () => teamsApi.remove(team.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const toggleMember = (f: TeamInput, setF: (u: (p: TeamInput) => TeamInput) => void, empId: string) => {
    setF((p) => {
      const members = p.members ?? [];
      return { ...p, members: members.includes(empId) ? members.filter((m) => m !== empId) : [...members, empId] };
    });
  };

  const renderFields = (f: TeamInput, setF: (u: (p: TeamInput) => TeamInput) => void, idPrefix: string) => (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-name`}>Team name</Label>
        <Input id={`${idPrefix}-name`} autoFocus value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="Platform Team" className="mt-1.5 bg-secondary/40 border-border/60" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Department</Label>
          <Select value={f.department ?? "none"} onValueChange={(v) => setF((p) => ({ ...p, department: v === "none" ? null : v }))}>
            <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Team lead</Label>
          <Select value={f.lead ?? "none"} onValueChange={(v) => setF((p) => ({ ...p, lead: v === "none" ? null : v }))}>
            <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <Textarea id={`${idPrefix}-desc`} value={f.description ?? ""} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" rows={2} />
      </div>
      <div>
        <Label>Members</Label>
        <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-border/60 bg-secondary/40 p-2 space-y-1">
          {employees.length === 0 && <div className="text-xs text-muted-foreground p-2">No employees yet</div>}
          {employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/60 cursor-pointer text-sm">
              <Checkbox checked={(f.members ?? []).includes(emp.id)} onCheckedChange={() => toggleMember(f, setF, emp.id)} />
              {emp.name}
            </label>
          ))}
        </div>
      </div>
    </>
  );

  const columns: DataTableColumn<Team>[] = [
    { key: "name", header: "Team", sortAccessor: (t) => t.name, exportAccessor: (t) => t.name, cell: (t) => <div className="font-medium">{t.name}</div> },
    { key: "department", header: "Department", sortAccessor: (t) => t.department?.name ?? "", exportAccessor: (t) => t.department?.name ?? "", cell: (t) => <span className="text-muted-foreground">{t.department?.name ?? "—"}</span> },
    { key: "lead", header: "Lead", sortAccessor: (t) => t.lead?.name ?? "", exportAccessor: (t) => t.lead?.name ?? "Unassigned", cell: (t) => <span className="text-muted-foreground">{t.lead?.name ?? "Unassigned"}</span> },
    { key: "members", header: "Members", sortAccessor: (t) => t.members.length, exportAccessor: (t) => t.members.length, cell: (t) => <span>{t.members.length}</span> },
  ];

  const rowActions = (): RowAction<Team>[] => canManage
    ? [
        { label: "Edit", icon: Pencil, onClick: (t) => { setEditing(t); setEditForm({ name: t.name, department: t.department?.id ?? null, lead: t.lead?.id ?? null, members: t.members.map((m) => m.id), description: t.description }); }, hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => teamsApi.restore(r.id).then(invalidate) }
          : { label: "Archive", icon: Archive, onClick: (r) => teamsApi.archive(r.id).then(invalidate) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [];

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add team</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Users2 className="h-4 w-4 text-accent" /> Add team</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                {renderFields(form, setForm, "new")}
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Creating&hellip;</span> : "Create team"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={teams}
        getId={(t) => t.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Users2}
        emptyTitle={archivedView ? "No archived teams" : "No teams yet"}
        emptyDescription="Group employees into teams with a lead and department."
        exportFilenameBase="teams"
        exportTitle="Teams"
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => teamsApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => teamsApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => teamsApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} team(s) deleted`)) },
        ] : undefined}
        toolbarExtra={<ArchivedToggle archived={archivedView} onChange={setArchivedView} />}
      />

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {editing.name}</DialogTitle></DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                {renderFields(editForm, setEditForm, "edit")}
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
        title={`Remove ${deleting?.name ?? "this team"}?`}
        description="This permanently deletes the team record after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}

export default function Departments() {
  const { user: me } = useAuth();
  const canManage = !!me?.companyRole && HR_COMPANY_ROLES.includes(me.companyRole);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Departments &amp; Teams</h1>
        <p className="text-muted-foreground mt-1">Organize your company's structure and reporting lines.</p>
      </div>
      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-6">
          <DepartmentsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="teams" className="mt-6">
          <TeamsTab canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
