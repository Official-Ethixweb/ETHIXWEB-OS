import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Briefcase, Copy, Eye, Loader2, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeesApi, type CreateEmployeeInput } from "@/api/employees";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/UserAvatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArchivedToggle } from "@/components/ArchivedToggle";
import { DataTable, type DataTableColumn, type RowAction } from "@/components/DataTable";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { HR_COMPANY_ROLES, type Department, type Employee, type EmployeeStatus } from "@/types";
import { format } from "date-fns";

const DEPARTMENTS: Department[] = ["Engineering", "Design", "HR", "Finance", "Sales", "Marketing", "Operations", "Support"];
const STATUSES: EmployeeStatus[] = ["active", "on_leave", "resigned", "terminated"];

const STATUS_STYLE: Record<Employee["status"], string> = {
  active: "bg-success/15 text-success border-success/30",
  on_leave: "bg-warning/15 text-warning border-warning/30",
  resigned: "bg-muted text-muted-foreground border-border",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

const emptyForm: CreateEmployeeInput = {
  name: "",
  email: "",
  department: "Engineering",
  designation: "",
  joiningDate: new Date().toISOString(),
};

function toEditForm(e: Employee): CreateEmployeeInput {
  return {
    name: e.name,
    email: e.email,
    phone: e.phone,
    department: e.department,
    designation: e.designation,
    employmentType: e.employmentType,
    joiningDate: e.joiningDate,
    status: e.status,
    salary: { amount: e.salary.amount, currency: e.salary.currency },
  };
}

export default function Employees() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canManage = !!me?.companyRole && HR_COMPANY_ROLES.includes(me.companyRole);
  const [params, setParams] = useSearchParams();
  const { run: runUndoable } = useUndoableAction();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string>("all");
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<CreateEmployeeInput>(emptyForm);

  const [editing, setEditing] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<CreateEmployeeInput>(emptyForm);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const { data: employees = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["employees", { archived: archivedView }],
    queryFn: () => employeesApi.list({ archived: archivedView }),
  });

  if (params.get("new") === "1" && canManage && !open) {
    setOpen(true);
    params.delete("new");
    setParams(params, { replace: true });
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const createMutation = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: (employee) => {
      invalidate();
      toast.success(`${employee.name} added to the team`);
      setForm(emptyForm);
      setOpen(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add employee")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeesApi.update(editing!.id, input),
    onSuccess: (employee) => {
      invalidate();
      toast.success(`${employee.name} updated`);
      setEditing(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update employee")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => employeesApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Employee duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate employee")),
  });

  const archiveOne = (id: string) => employeesApi.archive(id).then(invalidate);
  const restoreOne = (id: string) => employeesApi.restore(id).then(invalidate);
  const bulkArchive = (ids: string[]) => employeesApi.bulkArchive(ids).then(invalidate);
  const bulkRestore = (ids: string[]) => employeesApi.bulkRestore(ids).then(invalidate);

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (department !== "all" && e.department !== department) return false;
      if (!debouncedQuery) return true;
      const q = debouncedQuery.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    });
  }, [employees, department, debouncedQuery]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.designation.trim()) {
      return toast.error("Name, email, and designation are required");
    }
    createMutation.mutate({ ...form, name: form.name.trim(), email: form.email.trim(), designation: form.designation.trim() });
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.designation.trim()) {
      return toast.error("Name, email, and designation are required");
    }
    updateMutation.mutate(editForm);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setEditForm(toEditForm(emp));
  };

  const doDelete = (employee: Employee) => {
    qc.setQueryData<Employee[]>(["employees", { archived: archivedView }], (old) => old?.filter((e) => e.id !== employee.id));
    setDeleting(null);
    runUndoable({
      message: `${employee.name} deleted`,
      onCommit: () => employeesApi.remove(employee.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const columns: DataTableColumn<Employee>[] = [
    {
      key: "name",
      header: "Name",
      sortAccessor: (e) => e.name,
      exportAccessor: (e) => e.name,
      cell: (e) => (
        <div className="flex items-center gap-3">
          <UserAvatar user={{ name: e.name, avatarColor: "hsl(358 70% 32%)" }} size={32} />
          <div>
            <div className="font-medium">{e.name}</div>
            <div className="text-xs text-muted-foreground">{e.employeeId}</div>
          </div>
        </div>
      ),
    },
    { key: "designation", header: "Designation", sortAccessor: (e) => e.designation, exportAccessor: (e) => e.designation, cell: (e) => e.designation },
    { key: "department", header: "Department", sortAccessor: (e) => e.department, exportAccessor: (e) => e.department, cell: (e) => <Badge variant="outline" className="bg-secondary/60">{e.department}</Badge> },
    { key: "email", header: "Email", exportAccessor: (e) => e.email, cell: (e) => <span className="text-muted-foreground">{e.email}</span> },
    {
      key: "status",
      header: "Status",
      sortAccessor: (e) => e.status,
      exportAccessor: (e) => e.status,
      cell: (e) => <Badge variant="outline" className={STATUS_STYLE[e.status]}>{e.status.replace("_", " ")}</Badge>,
    },
    {
      key: "joiningDate",
      header: "Joined",
      sortAccessor: (e) => e.joiningDate,
      exportAccessor: (e) => format(new Date(e.joiningDate), "yyyy-MM-dd"),
      cell: (e) => <span className="text-muted-foreground">{format(new Date(e.joiningDate), "MMM d, yyyy")}</span>,
    },
  ];

  const rowActions = (e: Employee): RowAction<Employee>[] => canManage
    ? [
        { label: "View details", icon: Eye, onClick: (r) => navigate(`/app/employees/${r.id}`) },
        { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
        { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
        archivedView
          ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => restoreOne(r.id) }
          : { label: "Archive", icon: Archive, onClick: (r) => archiveOne(r.id) },
        { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
      ]
    : [{ label: "View details", icon: Eye, onClick: (r) => navigate(`/app/employees/${r.id}`) }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1">{employees.length} people across the company.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4 mr-1" /> Add employee
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-accent" /> Add a new employee</DialogTitle>
              </DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="ename">Full name</Label>
                  <Input id="ename" autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jordan Lee" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="eemail">Work email</Label>
                  <Input id="eemail" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jordan@ethixweb.com" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Department</Label>
                    <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v as Department }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edesig">Designation</Label>
                    <Input id="edesig" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="Product Designer" className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ejoin">Joining date</Label>
                  <Input id="ejoin" type="date" value={form.joiningDate.slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, joiningDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding&hellip;</span> : "Add employee"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getId={(e) => e.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Briefcase}
        emptyTitle={employees.length === 0 ? (archivedView ? "No archived employees" : "No employees yet") : "No one matches your search"}
        emptyDescription={canManage ? "Add your first team member to get started." : "Ask HR to add the team directory."}
        exportFilenameBase="employees"
        exportTitle="Employees"
        onRowClick={(e) => navigate(`/app/employees/${e.id}`)}
        rowActions={rowActions}
        bulkActions={canManage ? [
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: bulkRestore }
            : { label: "Archive", icon: Archive, onClick: bulkArchive },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => employeesApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} employee(s) deleted`)) },
        ] : undefined}
        toolbarExtra={
          <>
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" className="pl-9 bg-secondary/40 border-border/60" />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-40 bg-secondary/40 border-border/60"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <ArchivedToggle archived={archivedView} onChange={setArchivedView} />
          </>
        }
      />

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {editing.name}</DialogTitle>
              </DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="edit-name">Full name</Label>
                  <Input id="edit-name" autoFocus value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="edit-email">Work email</Label>
                  <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Department</Label>
                    <Select value={editForm.department} onValueChange={(v) => setEditForm((f) => ({ ...f, department: v as Department }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-desig">Designation</Label>
                    <Input id="edit-desig" value={editForm.designation} onChange={(e) => setEditForm((f) => ({ ...f, designation: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as EmployeeStatus }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-join">Joining date</Label>
                    <Input id="edit-join" type="date" value={editForm.joiningDate.slice(0, 10)} onChange={(e) => setEditForm((f) => ({ ...f, joiningDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-salary">Base salary (monthly)</Label>
                  <Input
                    id="edit-salary"
                    type="number"
                    min={0}
                    value={editForm.salary?.amount ?? 0}
                    onChange={(e) => setEditForm((f) => ({ ...f, salary: { amount: Number(e.target.value), currency: f.salary?.currency ?? "INR" } }))}
                    className="mt-1.5 bg-secondary/40 border-border/60"
                  />
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
        title={`Remove ${deleting?.name ?? "this employee"}?`}
        description="This permanently deletes the employee record after a few seconds (you can undo from the toast). Their attendance, leave, and payroll history will remain for audit purposes."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}
