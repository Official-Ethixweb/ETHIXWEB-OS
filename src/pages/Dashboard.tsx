import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListTodo,
  TrendingUp,
} from "lucide-react";
import {
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
import { useCurrentUser, useStore } from "@/store";
import { UserAvatar } from "@/components/UserAvatar";
import { formatDistanceToNow, isAfter } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  todo: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  done: "hsl(var(--success))",
};

export default function Dashboard() {
  const me = useCurrentUser();
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);

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
    { name: "To Do", value: stats.total - stats.done - stats.inProgress, color: "hsl(var(--muted-foreground))" },
  ];

  const recentTasks = [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const cards = [
    { label: "Total Tasks", value: stats.total, icon: ListTodo, accent: "from-primary/30 to-primary-glow/20" },
    { label: "Completed", value: stats.done, icon: CheckCircle2, accent: "from-success/30 to-success/10" },
    { label: "In Progress", value: stats.inProgress, icon: TrendingUp, accent: "from-accent/30 to-accent/10" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, accent: "from-destructive/30 to-destructive/10" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Welcome back, <span className="gradient-text">{me?.name?.split(" ")[0]}</span>
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's flowing across your team today.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative glass rounded-2xl p-5 overflow-hidden hover:-translate-y-0.5 transition-transform"
          >
            <div className={cn("absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl bg-gradient-to-br opacity-50", c.accent)} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</div>
                <div className="text-3xl font-bold mt-2">{c.value}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-secondary/60 grid place-items-center">
                <c.icon className="h-4 w-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">Tasks by project</div>
              <div className="text-xs text-muted-foreground">Status breakdown across all active projects</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="done" stackId="a" fill={STATUS_COLORS.done} radius={[0, 0, 0, 0]} />
                <Bar dataKey="inProgress" stackId="a" fill={STATUS_COLORS.in_progress} />
                <Bar dataKey="todo" stackId="a" fill={STATUS_COLORS.todo} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="font-semibold">Completion</div>
          <div className="text-xs text-muted-foreground">Live progress overview</div>
          <div className="h-56 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
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

      {/* Recent activity + projects */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">Recent activity</div>
            <Link to="/app/projects" className="text-xs text-primary-glow hover:underline">View projects</Link>
          </div>
          <div className="divide-y divide-border/60">
            {recentTasks.map((t) => {
              const project = projects.find((p) => p.id === t.projectId);
              const assignee = users.find((u) => u.id === t.assigneeId);
              return (
                <Link
                  key={t.id}
                  to={`/app/projects/${t.projectId}`}
                  className="flex items-center gap-3 py-3 hover:bg-secondary/30 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: `${project?.color}25`, color: project?.color }}>
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {project?.name} · {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <UserAvatar user={assignee} size={26} />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
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
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}, hsl(var(--primary-glow)))` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
