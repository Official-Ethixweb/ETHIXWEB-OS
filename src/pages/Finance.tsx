import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Archive, ArchiveRestore, ArrowDownCircle, ArrowUpCircle, Copy, FileText, Loader2, Pencil, Plus, Trash2, TrendingUp, Wallet } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { financeApi, type TransactionInput } from "@/api/finance";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ArchivedToggle } from "@/components/ArchivedToggle";
import { DataTable, type DataTableColumn, type RowAction } from "@/components/DataTable";
import { useCountUp } from "@/hooks/useCountUp";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import type { FinanceCategory, Transaction, TransactionType } from "@/types";
import { format } from "date-fns";

const CATEGORIES: FinanceCategory[] = ["Engineering", "Design", "HR", "Finance", "Sales", "Marketing", "Operations", "Support", "Other"];
const PIE_COLORS = ["hsl(358 70% 32%)", "hsl(358 82% 48%)", "hsl(38 90% 55%)", "hsl(150 60% 45%)", "hsl(358 60% 26%)", "hsl(0 0% 50%)", "hsl(358 76% 60%)", "hsl(0 0% 35%)", "hsl(358 40% 40%)"];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0); // last day of the month
  return { from: from.toISOString(), to: to.toISOString() };
}

function StatTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Wallet; tone: "success" | "destructive" | "primary" }) {
  const animated = useCountUp(Math.round(value));
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={`text-3xl font-bold mt-2 ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""}`}>
            ${animated.toLocaleString()}
          </div>
        </div>
        <div className="h-10 w-10 rounded-xl bg-secondary/60 grid place-items-center"><Icon className="h-4 w-4" /></div>
      </div>
    </motion.div>
  );
}

const emptyForm: TransactionInput = {
  type: "expense",
  amount: 0,
  category: "Operations",
  description: "",
  date: new Date().toISOString(),
};

function toEditForm(t: Transaction): TransactionInput {
  return {
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    category: t.category,
    description: t.description,
    date: t.date,
    recurring: t.recurring,
  };
}

export default function Finance() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { run: runUndoable } = useUndoableAction();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [archivedView, setArchivedView] = useState(false);
  const [form, setForm] = useState<TransactionInput>(emptyForm);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState<TransactionInput>(emptyForm);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["finance-transactions", month, { archived: archivedView }],
    queryFn: () => financeApi.list({ ...monthRange(month), archived: archivedView }),
  });

  const { data: summary } = useQuery({
    queryKey: ["finance-summary", month],
    queryFn: () => financeApi.summary({ month }),
  });

  if (params.get("new") === "1" && !open) {
    setOpen(true);
    params.delete("new");
    setParams(params, { replace: true });
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finance-transactions", month] });
    qc.invalidateQueries({ queryKey: ["finance-summary", month] });
  };

  const createMutation = useMutation({
    mutationFn: financeApi.create,
    onSuccess: () => { invalidate(); toast.success("Transaction recorded"); setForm(emptyForm); setOpen(false); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not record transaction")),
  });

  const updateMutation = useMutation({
    mutationFn: (input: TransactionInput) => financeApi.update(editing!.id, input),
    onSuccess: () => { invalidate(); toast.success("Transaction updated"); setEditing(null); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update transaction")),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => financeApi.duplicate(id),
    onSuccess: () => { invalidate(); toast.success("Transaction duplicated"); },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not duplicate transaction")),
  });

  const pieData = useMemo(() => (summary?.byCategory ?? []).map((c) => ({ name: c.category, value: c.total })), [summary]);
  const cashFlowData = useMemo(() => (summary?.cashFlow ?? []).map((c) => ({ ...c, date: format(new Date(c.date), "MMM d") })), [summary]);

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || form.amount <= 0) return toast.error("Description and a positive amount are required");
    createMutation.mutate(form);
  };

  const onUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.description.trim() || editForm.amount <= 0) return toast.error("Description and a positive amount are required");
    updateMutation.mutate(editForm);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setEditForm(toEditForm(t));
  };

  const doDelete = (t: Transaction) => {
    qc.setQueryData<Transaction[]>(["finance-transactions", month, { archived: archivedView }], (old) => old?.filter((x) => x.id !== t.id));
    setDeleting(null);
    runUndoable({
      message: `"${t.description}" deleted`,
      onCommit: () => financeApi.remove(t.id).then(invalidate),
      onUndo: invalidate,
    });
  };

  const exportPdf = () => financeApi.downloadReportPdf({ month }, `finance-report-${month}.pdf`);

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "description",
      header: "Description",
      sortAccessor: (t) => t.description,
      exportAccessor: (t) => t.description,
      cell: (t) => (
        <div className="flex items-center gap-2">
          {t.type === "income" ? <ArrowUpCircle className="h-4 w-4 text-success shrink-0" /> : <ArrowDownCircle className="h-4 w-4 text-destructive shrink-0" />}
          <span className="font-medium">{t.description}</span>
        </div>
      ),
    },
    { key: "category", header: "Category", sortAccessor: (t) => t.category, exportAccessor: (t) => t.category, cell: (t) => t.category },
    {
      key: "date",
      header: "Date",
      sortAccessor: (t) => t.date,
      exportAccessor: (t) => format(new Date(t.date), "yyyy-MM-dd"),
      cell: (t) => <span className="text-muted-foreground">{format(new Date(t.date), "MMM d, yyyy")}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortAccessor: (t) => t.amount,
      exportAccessor: (t) => (t.type === "income" ? t.amount : -t.amount),
      cell: (t) => <span className={`font-semibold ${t.type === "income" ? "text-success" : "text-destructive"}`}>{t.type === "income" ? "+" : "-"}${t.amount.toLocaleString()}</span>,
    },
  ];

  const rowActions = (): RowAction<Transaction>[] => [
    { label: "Edit", icon: Pencil, onClick: openEdit, hidden: () => archivedView },
    { label: "Duplicate", icon: Copy, onClick: (r) => duplicateMutation.mutate(r.id), hidden: () => archivedView },
    archivedView
      ? { label: "Restore", icon: ArchiveRestore, onClick: (r) => financeApi.restore(r.id).then(invalidate) }
      : { label: "Archive", icon: Archive, onClick: (r) => financeApi.archive(r.id).then(invalidate) },
    { label: "Delete", icon: Trash2, variant: "destructive", onClick: setDeleting },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground mt-1">Income, expenses, and cash flow, company-wide.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-secondary/40 border-border/60 w-40" />
          <Button variant="outline" size="sm" onClick={exportPdf} className="border-border/60"><FileText className="h-4 w-4 mr-1" /> PDF report</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-1" /> Add transaction</Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md">
              <DialogHeader><DialogTitle>Add transaction</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as TransactionType }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input id="amount" type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as FinanceCategory }))}>
                    <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="AWS hosting invoice" className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={form.date.slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, date: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                  {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving&hellip;</span> : "Add transaction"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Income" value={summary?.income ?? 0} icon={ArrowUpCircle} tone="success" />
        <StatTile label="Expenses" value={summary?.expense ?? 0} icon={ArrowDownCircle} tone="destructive" />
        <StatTile label="Profit" value={summary?.profit ?? 0} icon={TrendingUp} tone="primary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="font-semibold">Cash flow</div>
          <div className="text-xs text-muted-foreground">Income vs. expense this month</div>
          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(150 60% 45%)" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(150 60% 45%)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(358 76% 48%)" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(358 76% 48%)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="income" stroke="hsl(150 60% 45%)" fill="url(#incomeFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="hsl(358 76% 48%)" fill="url(#expenseFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Expense by department</div>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {pieData.map((d, i) => <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {pieData.length === 0 && <div className="text-sm text-muted-foreground text-center">No expenses yet.</div>}
        </div>
      </div>

      <div>
        <div className="font-semibold mb-3">Transactions</div>
        <DataTable
          columns={columns}
          rows={transactions}
          getId={(t) => t.id}
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyIcon={Wallet}
          emptyTitle={archivedView ? "No archived transactions" : `No transactions for ${month}`}
          exportFilenameBase={`finance-${month}`}
          exportTitle={`Finance — ${month}`}
          rowActions={rowActions}
          bulkActions={[
            archivedView
              ? { label: "Restore", icon: ArchiveRestore, onClick: (ids) => financeApi.bulkRestore(ids).then(invalidate) }
              : { label: "Archive", icon: Archive, onClick: (ids) => financeApi.bulkArchive(ids).then(invalidate) },
            { label: "Delete", icon: Trash2, variant: "destructive", onClick: (ids) => financeApi.bulkDelete(ids).then(invalidate).then(() => toast.success(`${ids.length} transaction(s) deleted`)) },
          ]}
          toolbarExtra={<ArchivedToggle archived={archivedView} onChange={setArchivedView} />}
        />
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="glass-strong border-border/60 max-w-md">
          {editing && (
            <>
              <DialogHeader><DialogTitle>Edit transaction</DialogTitle></DialogHeader>
              <form onSubmit={onUpdate} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={editForm.type} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as TransactionType }))}>
                      <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-amount">Amount ($)</Label>
                    <Input id="edit-amount" type="number" min={0} step="0.01" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: Number(e.target.value) }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v as FinanceCategory }))}>
                    <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Input id="edit-description" autoFocus value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="mt-1.5 bg-secondary/40 border-border/60" />
                </div>
                <div>
                  <Label htmlFor="edit-date">Date</Label>
                  <Input id="edit-date" type="date" value={editForm.date.slice(0, 10)} onChange={(e) => setEditForm((f) => ({ ...f, date: new Date(e.target.value).toISOString() }))} className="mt-1.5 bg-secondary/40 border-border/60" />
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
        title="Delete this transaction?"
        description={deleting ? `"${deleting.description}" (${deleting.type === "income" ? "+" : "-"}$${deleting.amount.toLocaleString()}) will be permanently removed after a few seconds (undo from the toast).` : ""}
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  );
}
