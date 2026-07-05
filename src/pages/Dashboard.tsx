import { useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Cake,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FolderPlus,
  Gift,
  Globe,
  HeartPulse,
  Laptop,
  ListTodo,
  Loader2,
  Palmtree,
  Search,
  Server as ServerIcon,
  TrendingUp,
  UserCheck,
  UserPlus2,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useAllTasks } from "@/hooks/useAllTasks";
import { useEmployees } from "@/hooks/useEmployees";
import { useEmployeeNotifications } from "@/hooks/useEmployeeNotifications";
import { useDerivedNotifications } from "@/hooks/useDerivedNotifications";
import { useRenewalNotifications } from "@/hooks/useRenewalNotifications";
import { usePayrollNotifications } from "@/hooks/usePayrollNotifications";
import { useCountUp } from "@/hooks/useCountUp";
import { UserAvatar } from "@/components/UserAvatar";
import { TiltCard } from "@/components/TiltCard";
import { RadialProgress } from "@/components/RadialProgress";
import { RenewalBadge } from "@/components/RenewalBadge";
import { DashboardGrid } from "@/components/DashboardGrid";
import { DASHBOARD_WIDGETS } from "@/config/dashboardWidgets";
import { format, formatDistanceToNow, isAfter, isSameDay, isSameMonth, startOfMonth, startOfWeek, addDays, subDays, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { financeApi } from "@/api/finance";
import { payrollApi } from "@/api/payroll";
import { attendanceApi } from "@/api/attendance";
import { subscriptionsApi } from "@/api/subscriptions";
import { domainsApi } from "@/api/domains";
import { serversApi } from "@/api/servers";

const STATUS_COLORS: Record<string, string> = {
  todo: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  done: "hsl(var(--success))",
};

const PIE_COLORS = ["hsl(358 70% 32%)", "hsl(358 82% 48%)", "hsl(38 90% 55%)", "hsl(150 60% 45%)", "hsl(358 60% 26%)", "hsl(0 0% 50%)", "hsl(358 76% 60%)", "hsl(0 0% 35%)", "hsl(358 40% 40%)"];

const chartTooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
};

export default function Dashboard() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const { projects, tasks, isLoading } = useAllTasks();
  const { employees, isLoading: employeesLoading } = useEmployees();
  const upcomingEvents = useEmployeeNotifications(employees).slice(0, 5);

  const headcount = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "active").length;
  const onLeaveToday = employees.filter((e) => e.status === "on_leave").length;

  const perms = me?.permissions ?? [];
  const canFinance = perms.includes("finance.view");
  const canOps = perms.includes("subscriptions.view") || perms.includes("domains.view") || perms.includes("servers.view") || perms.includes("clients.view") || perms.includes("vendors.view");
  const canHR = perms.includes("employees.manage");
  const currentMonth = format(new Date(), "yyyy-MM");
  const currentYear = format(new Date(), "yyyy");

  const { data: financeSummary } = useQuery({
    queryKey: ["finance-summary", currentMonth],
    queryFn: () => financeApi.summary({ month: currentMonth }),
    enabled: canFinance,
  });

  const { data: yearSummary } = useQuery({
    queryKey: ["finance-summary-year", currentYear],
    queryFn: () => financeApi.summary({ year: currentYear }),
    enabled: canFinance,
  });

  const { data: financeTrend = [] } = useQuery({
    queryKey: ["finance-trend"],
    queryFn: () => financeApi.trend(12),
    enabled: canFinance,
  });

  const { data: payrollTrendRaw = [] } = useQuery({
    queryKey: ["payroll-trend"],
    queryFn: () => payrollApi.trend(12),
    enabled: canFinance,
  });

  const { data: attendanceSummary } = useQuery({
    queryKey: ["attendance-summary"],
    queryFn: () => attendanceApi.summary(14),
    enabled: canHR,
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["payroll", currentMonth],
    queryFn: () => payrollApi.list({ month: currentMonth }),
    enabled: canFinance,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => subscriptionsApi.list(),
    enabled: canOps,
  });

  const { data: domains = [] } = useQuery({
    queryKey: ["domains"],
    queryFn: () => domainsApi.list(),
    enabled: canOps,
  });

  const { data: servers = [] } = useQuery({
    queryKey: ["servers"],
    queryFn: () => serversApi.list(),
    enabled: canOps,
  });

  const payrollTotals = useMemo(() => {
    const totalPay = payslips.reduce((sum, p) => sum + p.netPay, 0);
    const pending = payslips.filter((p) => p.paymentStatus === "pending");
    return { totalPay, pending: pending.length, due: pending.reduce((s, p) => s + p.netPay, 0) };
  }, [payslips]);

  const monthlySalary = useMemo(() => payslips.reduce((s, p) => s + p.baseSalary, 0), [payslips]);
  const yearlySalary = useMemo(() => payrollTrendRaw.reduce((s, r) => s + r.baseSalary, 0), [payrollTrendRaw]);

  const monthlyExpensePie = useMemo(() => (financeSummary?.byCategory ?? []).map((c) => ({ name: c.category, value: c.total })), [financeSummary]);
  const yearlyExpensePie = useMemo(() => (yearSummary?.byCategory ?? []).map((c) => ({ name: c.category, value: c.total })), [yearSummary]);

  const expenseTrendChart = useMemo(() => financeTrend.map((t) => ({ month: format(new Date(`${t.month}-01`), "MMM"), expense: t.expense, income: t.income })), [financeTrend]);
  const payrollTrendChart = useMemo(() => payrollTrendRaw.map((t) => ({ month: format(new Date(`${t.month}-01`), "MMM"), netPay: t.netPay })), [payrollTrendRaw]);

  const upcomingRenewals = useMemo(() => {
    const items = [
      ...subscriptions.map((s) => ({ id: `sub-${s.id}`, title: s.vendor, sub: s.plan || "Subscription", date: s.renewalDate, href: "/app/subscriptions" })),
      ...domains.map((d) => ({ id: `dom-${d.id}`, title: d.domainName, sub: "Domain", date: d.renewalDate, href: "/app/domains" })),
      ...servers.map((s) => ({ id: `srv-${s.id}`, title: s.label, sub: s.provider, date: s.renewalDate, href: "/app/servers" })),
    ];
    return items.filter((i) => i.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [subscriptions, domains, servers]);

  const domainExpiryCountdown = useMemo(
    () => [...domains].filter((d) => d.renewalDate).sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)).slice(0, 5),
    [domains]
  );

  const subscriptionCostPie = useMemo(
    () => subscriptions.map((s) => ({ name: s.vendor, value: s.cost.amount })).filter((s) => s.value > 0),
    [subscriptions]
  );

  const serverCostChart = useMemo(
    () => [...servers].sort((a, b) => b.cost.amount - a.cost.amount).slice(0, 8).map((s) => ({ name: s.label.length > 12 ? s.label.slice(0, 12) + "…" : s.label, cost: s.cost.amount })),
    [servers]
  );

  const infraCostComparison = useMemo(
    () => [
      { name: "Servers/mo", cost: servers.reduce((s, x) => s + x.cost.amount, 0) },
      { name: "Subscriptions/mo", cost: subscriptions.reduce((s, x) => s + x.cost.amount, 0) },
      { name: "Domains/yr", cost: domains.reduce((s, x) => s + x.cost.amount, 0) },
    ],
    [servers, subscriptions, domains]
  );

  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach((e) => counts.set(e.department, (counts.get(e.department) ?? 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const employeeGrowth = useMemo(() => {
    const months = Array.from({ length: 12 }).map((_, i) => subMonths(new Date(), 11 - i));
    return months.map((m) => {
      const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
      const count = employees.filter((e) => new Date(e.joiningDate) <= monthEnd).length;
      return { month: format(m, "MMM"), count };
    });
  }, [employees]);

  const attendanceTrendChart = useMemo(
    () => (attendanceSummary?.trend ?? []).map((t) => ({ date: format(new Date(t.date), "MMM d"), present: t.present, absent: t.absent, leave: t.leave })),
    [attendanceSummary]
  );

  const serverStatusCounts = useMemo(
    () => ({
      online: servers.filter((s) => s.status === "online").length,
      offline: servers.filter((s) => s.status === "offline").length,
      degraded: servers.filter((s) => s.status === "degraded").length,
    }),
    [servers]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue = tasks.filter(
      (t) => t.status !== "done" && t.dueDate && isAfter(new Date(), new Date(t.dueDate))
    ).length;
    return { total, done, inProgress, overdue, pending: total - done };
  }, [tasks]);

  const projectChart = useMemo(
    () =>
      projects.map((p) => {
        const pTasks = tasks.filter((t) => t.projectId === p.id);
        return {
          name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name,
          done: pTasks.filter((t) => t.status === "done").length,
          inProgress: pTasks.filter((t) => t.status === "in_progress").length,
          todo: pTasks.filter((t) => t.status === "todo").length,
        };
      }),
    [projects, tasks]
  );

  const pieData = [
    { name: "Done", value: stats.done, color: "hsl(var(--success))" },
    { name: "In Progress", value: stats.inProgress, color: "hsl(var(--primary))" },
    { name: "To Do", value: Math.max(stats.total - stats.done - stats.inProgress, 0), color: "hsl(var(--muted-foreground))" },
  ];

  const companyHealth = useMemo(() => {
    const completionScore = stats.total > 0 ? (stats.done / stats.total) * 100 : 100;
    const onTimeScore = stats.total > 0 ? ((stats.total - stats.overdue) / stats.total) * 100 : 100;
    const availabilityScore = headcount > 0 ? ((headcount - onLeaveToday) / headcount) * 100 : 100;
    return Math.round(completionScore * 0.4 + onTimeScore * 0.3 + availabilityScore * 0.3);
  }, [stats, headcount, onLeaveToday]);

  const taskTrend = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => subDays(new Date(), 13 - i));
    return days.map((d) => ({
      day: format(d, "MMM d"),
      created: tasks.filter((t) => isSameDay(new Date(t.createdAt), d)).length,
    }));
  }, [tasks]);

  const activityFeed = useMemo(() => {
    const taskEvents = tasks.map((t) => ({
      id: `task-${t.id}`,
      type: "task" as const,
      at: t.createdAt,
      title: t.title,
      meta: projects.find((p) => p.id === t.projectId)?.name ?? "",
      href: `/app/projects/${t.projectId}`,
    }));
    const employeeEvents = employees.map((e) => ({
      id: `emp-${e.id}`,
      type: "employee" as const,
      at: e.createdAt,
      title: `${e.name} joined the team`,
      meta: e.department,
      href: `/app/employees/${e.id}`,
    }));
    return [...taskEvents, ...employeeEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
  }, [tasks, employees, projects]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
    return days.map((day) => {
      const hasTask = tasks.some((t) => t.dueDate && isSameDay(new Date(t.dueDate), day));
      const hasEvent = employees.some(
        (e) =>
          (e.dateOfBirth && isSameMonth(new Date(e.dateOfBirth), day) && new Date(e.dateOfBirth).getDate() === day.getDate()) ||
          (isSameMonth(new Date(e.joiningDate), day) && new Date(e.joiningDate).getDate() === day.getDate())
      );
      return { day, inMonth: isSameMonth(day, monthStart), hasTask, hasEvent, isToday: isSameDay(day, new Date()) };
    });
  }, [tasks, employees]);

  const taskNotifications = useDerivedNotifications(tasks, projects);
  const employeeNotifications = useEmployeeNotifications(employees);
  const renewalNotifications = useRenewalNotifications(subscriptions, domains, servers);
  const payrollNotifications = usePayrollNotifications(payslips);
  const notifications = [...taskNotifications, ...employeeNotifications, ...renewalNotifications, ...payrollNotifications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const cards = [
    { label: "Total Tasks", value: stats.total, icon: ListTodo, accent: "from-primary/30 to-primary-glow/20", to: "/app/projects" },
    { label: "Completed", value: stats.done, icon: CheckCircle2, accent: "from-success/30 to-success/10", to: "/app/projects" },
    { label: "In Progress", value: stats.inProgress, icon: TrendingUp, accent: "from-accent/30 to-accent/10", to: "/app/projects" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, accent: "from-destructive/30 to-destructive/10", to: "/app/projects" },
  ];

  const kpiCards = [
    { label: "Total Employees", value: headcount, icon: Users, accent: "from-primary/30 to-primary-glow/20", to: "/app/employees" },
    { label: "Active Employees", value: activeEmployees, icon: UserCheck, accent: "from-success/30 to-success/10", to: "/app/employees" },
    { label: "Total Projects", value: projects.length, icon: Briefcase, accent: "from-accent/30 to-accent/10", to: "/app/projects" },
    ...(canOps
      ? [
          { label: "Total Domains", value: domains.length, icon: Globe, accent: "from-primary/30 to-primary-glow/20", to: "/app/domains" },
          { label: "Total Servers", value: servers.length, icon: ServerIcon, accent: "from-accent/30 to-accent/10", to: "/app/servers" },
          { label: "Total Subscriptions", value: subscriptions.length, icon: CreditCard, accent: "from-warning/30 to-warning/10", to: "/app/subscriptions" },
        ]
      : []),
    ...(canFinance ? [{ label: "Payroll Due", value: payrollTotals.due, icon: Wallet, accent: "from-destructive/30 to-destructive/10", to: "/app/payroll" }] : []),
  ];

  const financeCards = [
    { label: "Monthly Salary", value: monthlySalary, icon: Wallet, accent: "from-primary/30 to-primary-glow/20", to: "/app/payroll" },
    { label: "Yearly Salary (YTD)", value: yearlySalary, icon: Wallet, accent: "from-accent/30 to-accent/10", to: "/app/payroll" },
    { label: "Monthly Expense", value: financeSummary?.expense ?? 0, icon: DollarSign, accent: "from-destructive/30 to-destructive/10", to: "/app/finance" },
    { label: "Yearly Expense", value: yearSummary?.expense ?? 0, icon: DollarSign, accent: "from-warning/30 to-warning/10", to: "/app/finance" },
  ];

  const companyCards = [
    { label: "On Leave Today", value: onLeaveToday, icon: Palmtree, accent: "from-warning/30 to-warning/10", to: "/app/employees" },
  ];

  const quickActions = [
    { label: "New Project", icon: FolderPlus, onClick: () => navigate("/app/projects?new=1") },
    { label: "Add Employee", icon: UserPlus2, onClick: () => navigate("/app/employees?new=1") },
    ...(canFinance
      ? [
          { label: "Pay Salary", icon: Wallet, onClick: () => navigate("/app/payroll") },
          { label: "Add Bonus", icon: Gift, onClick: () => navigate("/app/payroll") },
          { label: "Add Transaction", icon: DollarSign, onClick: () => navigate("/app/finance?new=1") },
          { label: "View Analytics", icon: BarChart3, onClick: () => navigate("/app/finance") },
          { label: "Add Subscription", icon: CreditCard, onClick: () => navigate("/app/subscriptions?new=1") },
          { label: "Add Domain", icon: Globe, onClick: () => navigate("/app/domains?new=1") },
          { label: "Add Server", icon: ServerIcon, onClick: () => navigate("/app/servers?new=1") },
        ]
      : []),
    { label: "Search everything", icon: Search, onClick: () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })) },
  ];

  const content: Record<string, ReactNode> = {
    "kpi-overview": (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        {kpiCards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.04} />
        ))}
      </div>
    ),

    "finance-kpis": (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        {financeCards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.04} prefix="$" />
        ))}
      </div>
    ),

    "task-overview": (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.05} />
        ))}
      </div>
    ),

    "team-pulse": (
      <div className="grid lg:grid-cols-3 gap-4 h-full">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 flex items-center gap-4">
          <RadialProgress value={companyHealth} label="Health" />
          <div>
            <div className="font-semibold inline-flex items-center gap-1.5"><HeartPulse className="h-4 w-4 text-primary-glow" /> Company Health</div>
            <div className="text-xs text-muted-foreground mt-1">Blend of on-time delivery, completion, and team availability.</div>
          </div>
        </motion.div>
        {companyCards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={0.05 * i} />
        ))}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
          <div className="font-semibold inline-flex items-center gap-2 mb-2"><Bell className="h-4 w-4 text-accent" /> Notifications</div>
          {notifications.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">You're all caught up.</div>
          ) : (
            <div className="space-y-1.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => n.href && navigate(n.href)}
                  className="flex items-start gap-2 text-sm py-1 hover:translate-x-1 transition-transform cursor-pointer"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate">{n.message}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    ),

    "upcoming-events": (
      <div className="glass rounded-2xl p-6 h-full overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold inline-flex items-center gap-2"><Gift className="h-4 w-4 text-accent" /> Upcoming birthdays & anniversaries</div>
        </div>
        {employeesLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : upcomingEvents.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Nothing in the next two weeks.</div>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                <Link
                  to={n.employeeId ? `/app/employees/${n.employeeId}` : "/app/employees"}
                  className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-secondary/40 hover:translate-x-1 transition-all"
                >
                  <motion.div
                    className="h-9 w-9 rounded-lg grid place-items-center bg-accent/15 text-accent shrink-0"
                    whileHover={{ scale: 1.15, rotate: -6 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    {n.type === "birthday" ? <Cake className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
                  </motion.div>
                  <div className="text-sm">{n.message}</div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    ),

    "mini-calendar": (
      <div className="glass rounded-2xl p-6 h-full overflow-auto">
        <div className="font-semibold inline-flex items-center gap-2 mb-3"><CalendarDays className="h-4 w-4 text-primary-glow" /> {format(new Date(), "MMMM yyyy")}</div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="text-[0.6rem] text-muted-foreground">{d}</div>
          ))}
          {calendarDays.map((cd, i) => (
            <div
              key={i}
              className={cn(
                "relative h-7 rounded-md grid place-items-center text-[0.65rem]",
                !cd.inMonth && "text-muted-foreground/30",
                cd.inMonth && !cd.isToday && "text-foreground",
                cd.isToday && "bg-gradient-primary text-primary-foreground font-semibold"
              )}
            >
              {cd.day.getDate()}
              {(cd.hasTask || cd.hasEvent) && cd.inMonth && !cd.isToday && (
                <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", cd.hasEvent ? "bg-accent" : "bg-primary")} />
              )}
            </div>
          ))}
        </div>
      </div>
    ),

    "project-analytics":
      projects.length === 0 && !isLoading ? (
        <div className="glass rounded-3xl p-12 text-center h-full">
          <div className="font-semibold text-lg">No projects yet</div>
          <div className="text-sm text-muted-foreground mt-1">Create your first project to see analytics here.</div>
          <Link to="/app/projects?new=1" className="inline-block mt-5 px-4 py-2 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow text-sm font-medium">Create project</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 h-full">
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Tasks by project</div>
                <div className="text-xs text-muted-foreground">Status breakdown across all active projects</div>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="done" stackId="a" fill={STATUS_COLORS.done} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="inProgress" stackId="a" fill={STATUS_COLORS.in_progress} />
                  <Bar dataKey="todo" stackId="a" fill={STATUS_COLORS.todo} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="font-semibold">Completion</div>
            <div className="text-xs text-muted-foreground">Live progress overview</div>
            <div className="h-40 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3}>
                    {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</div>
                  <span className="text-muted-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),

    momentum: (
      <div className="glass rounded-2xl p-6 h-full">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-semibold inline-flex items-center gap-2"><Activity className="h-4 w-4 text-primary-glow" /> Momentum</div>
            <div className="text-xs text-muted-foreground">New tasks created, last 14 days</div>
          </div>
        </div>
        <div className="h-28 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={taskTrend}>
              <defs>
                <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary-glow))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={2} />
              <YAxis hide allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="created" stroke="hsl(var(--primary-glow))" strokeWidth={2} fill="url(#momentumFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    ),

    "activity-and-projects": (
      <div className="grid lg:grid-cols-3 gap-4 h-full">
        <div className="lg:col-span-2 glass rounded-2xl p-6 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Activity feed</div>
            <Link to="/app/projects" className="text-xs text-primary-glow hover:underline">View projects</Link>
          </div>
          <div className="divide-y divide-border/60">
            {activityFeed.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">No activity yet.</div>
            ) : activityFeed.map((a) => {
              const relatedTask = a.type === "task" ? tasks.find((t) => `task-${t.id}` === a.id) : undefined;
              const relatedEmployee = a.type === "employee" ? employees.find((e) => `emp-${e.id}` === a.id) : undefined;
              const project = relatedTask ? projects.find((p) => p.id === relatedTask.projectId) : undefined;
              return (
                <Link
                  key={a.id}
                  to={a.href}
                  className="flex items-center gap-3 py-3 hover:bg-secondary/30 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div
                    className="h-9 w-9 rounded-lg grid place-items-center"
                    style={
                      a.type === "task"
                        ? { background: `${project?.color}25`, color: project?.color }
                        : { background: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }
                    }
                  >
                    {a.type === "task" ? <Clock className="h-4 w-4" /> : <UserPlus2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.meta} · {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                    </div>
                  </div>
                  {relatedTask ? (
                    <UserAvatar user={relatedTask.assignee ?? undefined} size={26} />
                  ) : relatedEmployee ? (
                    <UserAvatar user={{ name: relatedEmployee.name, avatarColor: "hsl(358 70% 32%)" }} size={26} />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 overflow-auto">
          <div className="font-semibold mb-4">Your projects</div>
          <div className="space-y-2">
            {projects.map((p) => {
              const pTasks = tasks.filter((t) => t.projectId === p.id);
              const done = pTasks.filter((t) => t.status === "done").length;
              const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  to={`/app/projects/${p.id}`}
                  className="block rounded-xl p-3 bg-secondary/30 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    <div className="text-sm font-medium truncate flex-1">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{pct}%</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-background overflow-hidden">
                    <motion.div
                      className="h-full w-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${p.color}, hsl(var(--primary-glow)))`, transformOrigin: "left" }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: pct / 100 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    ),

    "finance-charts": (
      <div className="grid lg:grid-cols-2 gap-4 h-full">
        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Monthly expense trend</div>
          <div className="text-xs text-muted-foreground">Last 12 months</div>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseTrendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="expense" fill="hsl(358 76% 48%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Income vs expense</div>
          <div className="text-xs text-muted-foreground">Last 12 months</div>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseTrendChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="income" fill="hsl(150 60% 45%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="hsl(358 76% 48%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    ),

    "finance-breakdown": (
      <div className="grid lg:grid-cols-3 gap-4 h-full">
        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Monthly expense breakdown</div>
          <div className="text-xs text-muted-foreground">{format(new Date(), "MMMM yyyy")}</div>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={monthlyExpensePie} dataKey="value" innerRadius={35} outerRadius={60} paddingAngle={3}>
                  {monthlyExpensePie.map((d, i) => <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {monthlyExpensePie.length === 0 && <div className="text-xs text-muted-foreground text-center">No expenses yet.</div>}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Yearly expense breakdown</div>
          <div className="text-xs text-muted-foreground">{currentYear}</div>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={yearlyExpensePie} dataKey="value" innerRadius={35} outerRadius={60} paddingAngle={3}>
                  {yearlyExpensePie.map((d, i) => <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {yearlyExpensePie.length === 0 && <div className="text-xs text-muted-foreground text-center">No expenses yet.</div>}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Payroll trend</div>
          <div className="text-xs text-muted-foreground">Net pay, last 12 months</div>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollTrendChart}>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis hide />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="netPay" fill="hsl(var(--primary-glow))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    ),

    "infra-tiles": (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        <Link to="/app/finance" className="block">
          <TiltCard strength={4} className="glass glass-sheen rounded-2xl p-6 h-full hover:-translate-y-0.5 hover:shadow-glow transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary/20 grid place-items-center">
                <DollarSign className="h-4 w-4 text-primary-glow" />
              </div>
              <span className="text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full bg-success/15 text-success">Live</span>
            </div>
            <div className="font-semibold">Finance</div>
            {financeSummary ? (
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span className="text-success font-medium">+{financeSummary.income.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expense</span><span className="text-destructive font-medium">-{financeSummary.expense.toLocaleString()}</span></div>
                <div className="flex justify-between pt-1 border-t border-border/60"><span className="text-muted-foreground">Profit</span><span className="font-semibold">{financeSummary.profit.toLocaleString()}</span></div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mt-1">This month's cash flow</div>
            )}
          </TiltCard>
        </Link>

        <Link to="/app/payroll" className="block">
          <TiltCard strength={4} className="glass glass-sheen rounded-2xl p-6 h-full hover:-translate-y-0.5 hover:shadow-glow transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary/20 grid place-items-center">
                <Wallet className="h-4 w-4 text-primary-glow" />
              </div>
              <span className="text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full bg-success/15 text-success">Live</span>
            </div>
            <div className="font-semibold">Payroll</div>
            <div className="mt-2 text-2xl font-bold">{payrollTotals.totalPay.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {payslips.length} payslip{payslips.length === 1 ? "" : "s"} &middot; {payrollTotals.pending} pending
            </div>
          </TiltCard>
        </Link>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold inline-flex items-center gap-2"><Globe className="h-4 w-4 text-accent" /> Renewing soon</div>
          </div>
          {upcomingRenewals.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nothing renewing soon.</div>
          ) : (
            <div className="space-y-2">
              {upcomingRenewals.map((r) => (
                <Link key={r.id} to={r.href} className="flex items-center justify-between gap-2 py-1.5 hover:translate-x-1 transition-transform">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.sub}</div>
                  </div>
                  <RenewalBadge date={r.date} className="shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link to="/app/servers" className="block">
          <TiltCard strength={4} className="glass glass-sheen rounded-2xl p-6 h-full hover:-translate-y-0.5 hover:shadow-glow transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary/20 grid place-items-center">
                <ServerIcon className="h-4 w-4 text-primary-glow" />
              </div>
              <span className="text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full bg-success/15 text-success">Live</span>
            </div>
            <div className="font-semibold">Servers</div>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />{serverStatusCounts.online} online</span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{serverStatusCounts.degraded} degraded</span>
              <span>{serverStatusCounts.offline} offline</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">{servers.length} server{servers.length === 1 ? "" : "s"} total</div>
          </TiltCard>
        </Link>
      </div>
    ),

    "infra-charts": (
      <div className="grid lg:grid-cols-3 gap-4 h-full">
        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Subscription cost breakdown</div>
          <div className="text-xs text-muted-foreground">By vendor</div>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={subscriptionCostPie} dataKey="value" innerRadius={35} outerRadius={60} paddingAngle={3}>
                  {subscriptionCostPie.map((d, i) => <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {subscriptionCostPie.length === 0 && <div className="text-xs text-muted-foreground text-center">No subscriptions yet.</div>}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="font-semibold">Server cost</div>
          <div className="text-xs text-muted-foreground">Top servers by monthly cost</div>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serverCostChart} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="cost" fill="hsl(var(--primary-glow))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {serverCostChart.length === 0 && <div className="text-xs text-muted-foreground text-center">No servers yet.</div>}
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="font-semibold inline-flex items-center gap-2"><Laptop className="h-4 w-4 text-accent" /> Domain expiry countdown</div>
          {domainExpiryCountdown.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No domains yet.</div>
          ) : (
            <div className="space-y-2 mt-3">
              {domainExpiryCountdown.map((d) => (
                <Link key={d.id} to="/app/domains" className="flex items-center justify-between gap-2 py-1 hover:translate-x-1 transition-transform">
                  <div className="text-sm font-medium truncate">{d.domainName}</div>
                  <RenewalBadge date={d.renewalDate} className="shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    ),

    "infra-cost-comparison": (
      <div className="glass rounded-2xl p-6 h-full">
        <div className="font-semibold">Infrastructure cost comparison</div>
        <div className="text-xs text-muted-foreground">Servers & subscriptions monthly, domains yearly</div>
        <div className="h-40 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={infraCostComparison}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="cost" fill="hsl(var(--primary-glow))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    ),

    "hr-stats": (
      <div className="grid sm:grid-cols-2 gap-4 h-full">
        <StatCard label="Attendance %" value={attendanceSummary?.attendancePct ?? 0} icon={UserCheck} accent="from-success/30 to-success/10" suffix="%" />
        <StatCard label="Leave %" value={attendanceSummary?.leavePct ?? 0} icon={Palmtree} accent="from-warning/30 to-warning/10" suffix="%" />
      </div>
    ),

    "hr-charts": (
      <div className="grid lg:grid-cols-3 gap-4 h-full">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="font-semibold inline-flex items-center gap-2"><UserPlus2 className="h-4 w-4 text-primary-glow" /> Employee growth</div>
          <div className="text-xs text-muted-foreground">Headcount over the last 12 months</div>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={employeeGrowth}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary-glow))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary-glow))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary-glow))" strokeWidth={2} fill="url(#growthFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="font-semibold inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /> By department</div>
          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentCounts} layout="vertical">
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="value" fill="hsl(var(--primary-glow))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    ),

    "hr-attendance-trend": (
      <div className="glass rounded-2xl p-6 h-full">
        <div className="font-semibold">Attendance trend</div>
        <div className="text-xs text-muted-foreground">Last 14 days</div>
        <div className="h-40 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={attendanceTrendChart}>
              <defs>
                <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(150 60% 45%)" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(150 60% 45%)" stopOpacity={0} /></linearGradient>
                <linearGradient id="leaveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(38 90% 55%)" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(38 90% 55%)" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="present" stroke="hsl(150 60% 45%)" fill="url(#presentFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="leave" stroke="hsl(38 90% 55%)" fill="url(#leaveFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          {attendanceTrendChart.length === 0 && <div className="text-xs text-muted-foreground text-center mt-2">No attendance marked yet.</div>}
        </div>
      </div>
    ),
  };

  const visibleRegistry = useMemo(
    () => DASHBOARD_WIDGETS.filter((w) => !w.permissionAnyOf || w.permissionAnyOf.some((p) => perms.includes(p))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perms.join(",")]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Welcome back, <span className="gradient-text">{me?.name?.split(" ")[0]}</span>
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's flowing across your team today.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isLoading && (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-2 mr-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Syncing data…
            </div>
          )}
          {quickActions.map((qa) => (
            <motion.button
              key={qa.label}
              onClick={qa.onClick}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-medium hover:border-primary/40 hover:bg-secondary/60 transition-colors"
            >
              <qa.icon className="h-3.5 w-3.5" /> {qa.label}
            </motion.button>
          ))}
        </div>
      </div>

      <DashboardGrid registry={visibleRegistry} content={content} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: typeof ListTodo;
  accent: string;
  delay?: number;
  to?: string;
  prefix?: string;
  suffix?: string;
}

function StatCard({ label, value, icon: Icon, accent, delay = 0, to, prefix, suffix }: StatCardProps) {
  const animated = useCountUp(value);
  const content = (
    <TiltCard strength={5} className="glass glass-sheen rounded-2xl p-6 overflow-hidden hover:-translate-y-0.5 hover:shadow-glow transition-all h-full">
      <div className={cn("absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl bg-gradient-to-br opacity-50", accent)} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold mt-2">{prefix}{animated.toLocaleString()}{suffix}</div>
        </div>
        <motion.div
          className="h-10 w-10 rounded-xl bg-secondary/60 grid place-items-center"
          whileHover={{ rotate: 8, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <Icon className="h-4 w-4" />
        </motion.div>
      </div>
    </TiltCard>
  );
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="h-full">
      {to ? <Link to={to} className="block h-full">{content}</Link> : content}
    </motion.div>
  );
}
