import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, CalendarRange, CheckCircle2, Download, Eye, Loader2, Plus, Trash2, Wallet, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { payrollApi } from "@/api/payroll";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArchivedToggle } from "@/components/ArchivedToggle";
import { DataTable, type DataTableColumn, type RowAction } from "@/components/DataTable";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import type { PayLineItem, Payslip } from "@/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function Payroll() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [archivedView, setArchivedView] = useState(false);
  const [editing, setEditing] = useState<Payslip | null>(null);
  const [deleting, setDeleting] = useState<Payslip | null>(null);
  const [bonusLabel, setBonusLabel] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [deductionLabel, setDeductionLabel] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("");
  const { run: runUndoable } = useUndoableAction();

  const { data: payslips = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["payroll", month, { archived: archivedView }],
    queryFn: () => payrollApi.list({ month, archived: archivedView }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["payroll", month] });

  const generateMutation = useMutation({
    mutationFn: () => payrollApi.generate(month),
    onSuccess: (res) => {
      invalidate();
      toast.success(res.created > 0 ? `Generated ${res.created} payslip(s)` : "All payslips already exist for this month");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not generate payroll")),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: { bonuses?: PayLineItem[]; deductions?: PayLineItem[] }) => payrollApi.update(editing!.id, patch),
    onSuccess: (p) => {
      qc.setQueryData<Payslip[]>(["payroll", month, { archived: archivedView }], (old) => old?.map((x) => (x.id === p.id ? p : x)));
      setEditing(p);
      toast.success("Payslip updated");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update payslip")),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => payrollApi.markPaid(id),
    onSuccess: (p) => {
      qc.setQueryData<Payslip[]>(["payroll", month, { archived: archivedView }], (old) => old?.map((x) => (x.id === p.id ? p : x)));
      if (editing?.id === p.id) setEditing(p);
      toast.success("Marked as paid");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not mark as paid")),
  });

  const totals = useMemo(() => {
    const totalPay = payslips.reduce((sum, p) => sum + p.netPay, 0);
    const pending = payslips.filter((p) => p.paymentStatus === "pending").length;
    return { totalPay, pending };
  }, [payslips]);

  const addBonus = () => {
    if (!editing || !bonusLabel.trim() || !bonusAmount) return;
    updateMutation.mutate({ bonuses: [...editing.bonuses, { label: bonusLabel, amount: Number(bonusAmount) }] });
    setBonusLabel("");
    setBonusAmount("");
  };
  const addDeduction = () => {
    if (!editing || !deductionLabel.trim() || !deductionAmount) return;
    updateMutation.mutate({ deductions: [...editing.deductions, { label: deductionLabel, amount: Number(deductionAmount) }] });
    setDeductionLabel("");
    setDeductionAmount("");
  };
  const removeBonus = (i: number) => editing && updateMutation.mutate({ bonuses: editing.bonuses.filter((_, idx) => idx !== i) });
  const removeDeduction = (i: number) => editing && updateMutation.mutate({ deductions: editing.deductions.filter((_, idx) => idx !== i) });

  const doDelete = (payslip: Payslip) => {
    qc.setQueryData<Payslip[]>(["payroll", month, { archived: archivedView }], (old) => old?.filter((p) => p.id !== payslip.id));
    setDeleting(null);
    if (editing?.id === payslip.id) setEditing(null);
    runUndoable({
      message: `Payslip for ${payslip.employee?.name ?? "employee"} deleted`,
      onCommit: () => payrollApi.remove(payslip.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const columns: DataTableColumn<Payslip>[] = [
    {
      key: "employee",
      header: "Employee",
      sortAccessor: (p) => p.employee?.name ?? "",
      exportAccessor: (p) => p.employee?.name ?? "",
      cell: (p) => (
        <div>
          <div className="font-medium">{p.employee?.name || "—"}</div>
          <div className="text-xs text-muted-foreground">{p.employee?.designation} {p.employee?.designation && p.employee?.department ? "·" : ""} {p.employee?.department}</div>
        </div>
      ),
    },
    { key: "baseSalary", header: "Base", sortAccessor: (p) => p.baseSalary, exportAccessor: (p) => p.baseSalary, cell: (p) => <span className="text-muted-foreground">{p.baseSalary.toLocaleString()}</span> },
    { key: "netPay", header: "Net pay", sortAccessor: (p) => p.netPay, exportAccessor: (p) => p.netPay, cell: (p) => <span className="font-semibold">{p.netPay.toLocaleString()} {p.currency}</span> },
    {
      key: "paymentStatus",
      header: "Status",
      sortAccessor: (p) => p.paymentStatus,
      exportAccessor: (p) => p.paymentStatus,
      cell: (p) => <Badge variant="outline" className={p.paymentStatus === "paid" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>{p.paymentStatus}</Badge>,
    },
  ];

  const rowActions = (): RowAction<Payslip>[] => [
    { label: "View / edit", icon: Eye, onClick: setEditing },
    { label: "Download PDF", icon: Download, onClick: (p) => payrollApi.downloadPdf(p.id, `payslip-${p.employee?.employeeId}-${p.month}.pdf`) },
    { label: "Mark paid", icon: CheckCircle2, onClick: (p) => markPaidMutation.mutate(p.id), hidden: (p) => p.paymentStatus === "paid" || archivedView },
    archivedView
      ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => payrollApi.restore(r.id).then(invalidate) }
      : { label: "Archive", icon: Archive, onClick: (r) => payrollApi.archive(r.id).then(invalidate) },
    { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground mt-1">
            {payslips.length} payslips &middot; ${totals.totalPay.toLocaleString()} total &middot; {totals.pending} pending
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <CalendarRange className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="pl-9 bg-secondary/40 border-border/60 w-40" />
          </div>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Generate this month
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={payslips}
        getId={(p) => p.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyIcon={Wallet}
        emptyTitle={archivedView ? "No archived payslips" : `No payslips for ${month}`}
        emptyDescription={archivedView ? undefined : 'Click "Generate this month" to create payslips for every active employee.'}
        exportFilenameBase={`payroll-${month}`}
        exportTitle={`Payroll — ${month}`}
        onRowClick={(p) => setEditing(p)}
        rowActions={rowActions}
        bulkActions={[
          archivedView
            ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => payrollApi.bulkRestore(ids).then(invalidate) }
            : { label: "Archive", icon: Archive, onClick: (ids) => payrollApi.bulkArchive(ids).then(invalidate) },
          { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => payrollApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} payslip(s) deleted`)) },
        ]}
        toolbarExtra={<ArchivedToggle archived={archivedView} onChange={setArchivedView} />}
      />

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader><DialogTitle>{editing.employee?.name} &middot; {editing.month}</DialogTitle></DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base salary</span>
                  <span className="font-medium">{editing.baseSalary.toLocaleString()} {editing.currency}</span>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bonuses</Label>
                  <div className="space-y-1.5 mt-2">
                    {editing.bonuses.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-secondary/30 px-3 py-2">
                        <span>{b.label}</span>
                        <div className="flex items-center gap-2">
                          <span>+{b.amount.toLocaleString()}</span>
                          <button onClick={() => removeBonus(i)}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input value={bonusLabel} onChange={(e) => setBonusLabel(e.target.value)} placeholder="Label" className="bg-secondary/40 border-border/60 h-9 text-sm" />
                    <Input value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} type="number" placeholder="Amount" className="bg-secondary/40 border-border/60 h-9 text-sm w-28" />
                    <Button size="sm" onClick={addBonus} disabled={updateMutation.isPending}>Add</Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Deductions</Label>
                  <div className="space-y-1.5 mt-2">
                    {editing.deductions.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-secondary/30 px-3 py-2">
                        <span>{d.label}</span>
                        <div className="flex items-center gap-2">
                          <span>-{d.amount.toLocaleString()}</span>
                          <button onClick={() => removeDeduction(i)}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input value={deductionLabel} onChange={(e) => setDeductionLabel(e.target.value)} placeholder="Label" className="bg-secondary/40 border-border/60 h-9 text-sm" />
                    <Input value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} type="number" placeholder="Amount" className="bg-secondary/40 border-border/60 h-9 text-sm w-28" />
                    <Button size="sm" onClick={addDeduction} disabled={updateMutation.isPending}>Add</Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <span className="font-semibold">Net pay</span>
                  <span className="text-xl font-bold gradient-text">{editing.netPay.toLocaleString()} {editing.currency}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => payrollApi.downloadPdf(editing.id, `payslip-${editing.employee?.employeeId}-${editing.month}.pdf`)}
                  >
                    Download PDF
                  </Button>
                  {editing.paymentStatus === "pending" && (
                    <Button className="flex-1 bg-gradient-primary text-primary-foreground" onClick={() => markPaidMutation.mutate(editing.id)} disabled={markPaidMutation.isPending}>
                      Mark paid
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setDeleting(editing)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete payslip
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete payslip for ${deleting?.employee?.name ?? "this employee"}?`}
        description="This permanently deletes the payslip after a few seconds (undo from the toast)."
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}
