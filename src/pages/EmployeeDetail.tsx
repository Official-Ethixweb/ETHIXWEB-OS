import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Calendar, FileText, IndianRupee, Laptop, Loader2, Lock, Mail, Pencil, Phone, Trash2, Wallet } from "lucide-react";
import { format } from "date-fns";
import { employeesApi, type CreateEmployeeInput } from "@/api/employees";
import { attendanceApi } from "@/api/attendance";
import { leavesApi } from "@/api/leaves";
import { payrollApi } from "@/api/payroll";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { FINANCE_COMPANY_ROLES, HR_COMPANY_ROLES, type Department, type Employee, type EmployeeStatus } from "@/types";

const DEPARTMENTS: Department[] = ["Engineering", "Design", "HR", "Finance", "Sales", "Marketing", "Operations", "Support"];
const STATUSES: EmployeeStatus[] = ["active", "on_leave", "resigned", "terminated"];

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

const STATUS_STYLE: Record<Employee["status"], string> = {
  active: "bg-success/15 text-success border-success/30",
  on_leave: "bg-warning/15 text-warning border-warning/30",
  resigned: "bg-muted text-muted-foreground border-border",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function EmployeeDetail() {
  const { employeeId = "" } = useParams<{ employeeId: string }>();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = !!me?.companyRole && HR_COMPANY_ROLES.includes(me.companyRole);
  const canViewPayroll = !!me?.companyRole && FINANCE_COMPANY_ROLES.includes(me.companyRole);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<CreateEmployeeInput>({ name: "", email: "", department: "Engineering", designation: "", joiningDate: new Date().toISOString() });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => employeesApi.get(employeeId),
    enabled: !!employeeId,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", employeeId],
    queryFn: () => attendanceApi.list({ employee: employeeId }),
    enabled: !!employeeId,
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves", employeeId],
    queryFn: () => leavesApi.list({ employee: employeeId }),
    enabled: !!employeeId,
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["payslips", employeeId],
    queryFn: () => payrollApi.list({ employee: employeeId }),
    enabled: !!employeeId && canViewPayroll,
  });

  const markPresentMutation = useMutation({
    mutationFn: () => attendanceApi.mark(employeeId, new Date().toISOString(), "present"),
    onSuccess: () => {
      toast.success("Marked present for today");
      qc.invalidateQueries({ queryKey: ["attendance", employeeId] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not mark attendance")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: CreateEmployeeInput) => employeesApi.update(employeeId, input),
    onSuccess: (updated) => {
      qc.setQueryData(["employee", employeeId], updated);
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee updated");
      setEditOpen(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update employee")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => employeesApi.remove(employeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee removed");
      navigate("/app/employees");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not remove employee")),
  });

  const openEdit = () => {
    if (!employee) return;
    setEditForm(toEditForm(employee));
    setEditOpen(true);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.designation.trim()) {
      return toast.error("Name, email, and designation are required");
    }
    updateMutation.mutate(editForm);
  };

  if (isLoading || !employee) {
    return (
      <div className="glass rounded-3xl p-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/app/employees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Employees
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <motion.div
          className="absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-20 blur-3xl bg-primary"
          animate={{ opacity: [0.15, 0.28, 0.15], scale: [1, 1.06, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex flex-col md:flex-row md:items-center gap-5">
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <UserAvatar user={{ name: employee.name, avatarColor: "hsl(358 70% 32%)" }} size={72} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{employee.name}</h1>
              <Badge variant="outline" className={STATUS_STYLE[employee.status]}>{employee.status.replace("_", " ")}</Badge>
            </div>
            <div className="text-muted-foreground mt-1">{employee.designation} · {employee.department}</div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {employee.email}</span>
              {employee.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {employee.phone}</span>}
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Joined {format(new Date(employee.joiningDate), "MMM d, yyyy")}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewPayroll && (
              <Button asChild variant="outline" className="border-border/60 bg-secondary/40">
                <Link to="/app/payroll"><Wallet className="h-4 w-4 mr-1.5" /> Pay salary</Link>
              </Button>
            )}
            <Button onClick={() => markPresentMutation.mutate()} disabled={markPresentMutation.isPending} variant="outline" className="border-border/60 bg-secondary/40">
              {markPresentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Mark present today
            </Button>
            {canManage && (
              <>
                <Button onClick={openEdit} variant="outline" size="icon" className="border-border/60 bg-secondary/40" aria-label="Edit employee">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button onClick={() => setDeleteOpen(true)} variant="outline" size="icon" className="border-border/60 bg-secondary/40 text-destructive hover:text-destructive" aria-label="Delete employee">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="overview">
        <TabsList className="glass border border-border/60">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="salary">Salary History</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid md:grid-cols-2 gap-4 mt-4">
          <TabPanel>
            <div className="font-semibold mb-3">Employment</div>
            <dl className="space-y-2 text-sm">
              <Row label="Employee ID" value={employee.employeeId} />
              <Row label="Employment type" value={employee.employmentType.replace("_", " ")} />
              <Row label="Company role" value={employee.companyRole} />
              <Row label="Experience" value={`${employee.experienceYears} years`} />
              {employee.dateOfBirth && <Row label="Date of birth" value={format(new Date(employee.dateOfBirth), "MMM d, yyyy")} />}
            </dl>
          </TabPanel>
          <TabPanel delay={0.06}>
            <div className="font-semibold mb-3">Skills</div>
            {employee.skills.length === 0 ? (
              <div className="text-sm text-muted-foreground">No skills recorded.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {employee.skills.map((s) => (
                  <span key={s} className="px-2.5 py-1 rounded-full bg-secondary/60 text-xs hover:bg-secondary transition-colors">{s}</span>
                ))}
              </div>
            )}
            <div className="font-semibold mt-5 mb-2">Notes</div>
            <div className="text-sm text-muted-foreground">{employee.notes || "No notes yet."}</div>
          </TabPanel>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <TabPanel>
            {employee.documents.length === 0 ? (
              <EmptyState icon={FileText} text="No documents uploaded yet." />
            ) : (
              <div className="space-y-2">
                {employee.documents.map((d, i) => (
                  <a key={i} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl p-3 bg-secondary/30 hover:bg-secondary/60 hover:translate-x-1 transition-all">
                    <span className="inline-flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-muted-foreground" /> {d.type}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(d.uploadedAt), "MMM d, yyyy")}</span>
                  </a>
                ))}
              </div>
            )}
          </TabPanel>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <TabPanel>
            {attendance.length === 0 ? (
              <EmptyState icon={Calendar} text="No attendance recorded yet." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {attendance.slice(0, 20).map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="rounded-xl p-3 bg-secondary/30 text-sm hover:bg-secondary/50 transition-colors"
                  >
                    <div className="text-xs text-muted-foreground">{format(new Date(a.date), "EEE, MMM d")}</div>
                    <div className={`mt-1 font-medium capitalize ${a.status === "present" ? "text-success" : a.status === "absent" ? "text-destructive" : "text-warning"}`}>{a.status}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabPanel>
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <TabPanel>
            {leaves.length === 0 ? (
              <EmptyState icon={Calendar} text="No leave requests." />
            ) : (
              <div className="space-y-2">
                {leaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div>
                      <div className="text-sm font-medium capitalize">{l.type} leave</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(l.startDate), "MMM d")} – {format(new Date(l.endDate), "MMM d, yyyy")}</div>
                    </div>
                    <Badge variant="outline" className={l.status === "approved" ? "bg-success/15 text-success border-success/30" : l.status === "rejected" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-warning/15 text-warning border-warning/30"}>
                      {l.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabPanel>
        </TabsContent>

        <TabsContent value="salary" className="mt-4">
          <TabPanel>
            {!canViewPayroll ? (
              <EmptyState icon={Lock} text="Only Finance, HR, and Owner roles can view payroll details." />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <IndianRupee className="h-4 w-4 text-primary-glow" />
                  <span className="text-2xl font-bold">{employee.salary.amount.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">{employee.salary.currency} / month (current base)</span>
                </div>
                {payslips.length === 0 ? (
                  <EmptyState icon={IndianRupee} text="No payslips generated yet. Generate this month's payroll from the Payroll page." />
                ) : (
                  <div className="space-y-2">
                    {payslips.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors text-sm">
                        <span>{p.month}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Net {p.netPay.toLocaleString()} {p.currency}</span>
                          <Badge variant="outline" className={p.paymentStatus === "paid" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>
                            {p.paymentStatus}
                          </Badge>
                          <button
                            onClick={() => payrollApi.downloadPdf(p.id, `payslip-${employee.employeeId}-${p.month}.pdf`)}
                            className="text-xs text-primary-glow hover:underline"
                          >
                            PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabPanel>
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <TabPanel>
            {employee.assignedAssets.length === 0 ? (
              <EmptyState icon={Laptop} text="No assets assigned yet." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {employee.assignedAssets.map((a, i) => (
                  <div key={i} className="rounded-xl p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.type} · assigned {format(new Date(a.assignedDate), "MMM d, yyyy")}</div>
                  </div>
                ))}
              </div>
            )}
          </TabPanel>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-accent" /> Edit {employee.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onUpdate} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="d-edit-name">Full name</Label>
              <Input id="d-edit-name" autoFocus value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
            </div>
            <div>
              <Label htmlFor="d-edit-email">Work email</Label>
              <Input id="d-edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
            </div>
            <div>
              <Label htmlFor="d-edit-phone">Phone</Label>
              <Input id="d-edit-phone" value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
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
                <Label htmlFor="d-edit-desig">Designation</Label>
                <Input id="d-edit-desig" value={editForm.designation} onChange={(e) => setEditForm((f) => ({ ...f, designation: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
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
                <Label htmlFor="d-edit-join">Joining date</Label>
                <Input id="d-edit-join" type="date" value={editForm.joiningDate.slice(0, 10)} onChange={(e) => setEditForm((f) => ({ ...f, joiningDate: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
              </div>
            </div>
            {canViewPayroll && (
              <div>
                <Label htmlFor="d-edit-salary">Base salary (monthly)</Label>
                <Input
                  id="d-edit-salary"
                  type="number"
                  min={0}
                  value={editForm.salary?.amount ?? 0}
                  onChange={(e) => setEditForm((f) => ({ ...f, salary: { amount: Number(e.target.value), currency: f.salary?.currency ?? "INR" } }))}
                  className="mt-1.5 bg-secondary/40 border-border/60"
                />
              </div>
            )}
            <Button type="submit" disabled={updateMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
              {updateMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving&hellip;</span> : "Save changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Remove ${employee.name}?`}
        description="This permanently deletes the employee record. Their attendance, leave, and payroll history will remain for audit purposes but will no longer be linked to an active profile."
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

function TabPanel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className="glass rounded-2xl p-6"
    >
      {children}
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground capitalize">{label}</dt>
      <dd className="font-medium capitalize">{value}</dd>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Briefcase; text: string }) {
  return (
    <div className="text-center py-8">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <div className="text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
