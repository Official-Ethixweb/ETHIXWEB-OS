import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Notification, Project, Role, Status, Task, User } from "@/types";

const colors = ["#6366F1", "#A855F7", "#22D3EE", "#F472B6", "#34D399", "#FB923C"];
const pick = (i: number) => colors[i % colors.length];

const seedUsers: User[] = [
  { id: "u_alex", name: "Alex Rivera", email: "alex@teamflow.app", avatarColor: pick(0) },
  { id: "u_sam", name: "Sam Chen", email: "sam@teamflow.app", avatarColor: pick(1) },
  { id: "u_priya", name: "Priya Patel", email: "priya@teamflow.app", avatarColor: pick(2) },
  { id: "u_jordan", name: "Jordan Kim", email: "jordan@teamflow.app", avatarColor: pick(3) },
];

const now = () => new Date().toISOString();
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

const seedProjects: Project[] = [
  {
    id: "p_launch",
    name: "Q4 Product Launch",
    description: "Coordinate the marketing site refresh, launch video, and press outreach for the v3 release.",
    color: "#6366F1",
    createdAt: now(),
    members: [
      { userId: "u_alex", role: "admin" },
      { userId: "u_sam", role: "member" },
      { userId: "u_priya", role: "member" },
    ],
  },
  {
    id: "p_mobile",
    name: "Mobile App Redesign",
    description: "Refresh information architecture and ship a new design system for iOS and Android.",
    color: "#A855F7",
    createdAt: now(),
    members: [
      { userId: "u_sam", role: "admin" },
      { userId: "u_alex", role: "member" },
      { userId: "u_jordan", role: "member" },
    ],
  },
  {
    id: "p_growth",
    name: "Growth Experiments",
    description: "Run A/B tests on onboarding, pricing page, and referral loops to lift activation.",
    color: "#22D3EE",
    createdAt: now(),
    members: [
      { userId: "u_priya", role: "admin" },
      { userId: "u_alex", role: "member" },
    ],
  },
];

const seedTasks: Task[] = [
  { id: "t1", projectId: "p_launch", title: "Draft launch announcement post", status: "in_progress", priority: "high", assigneeId: "u_sam", dueDate: daysFromNow(2), createdAt: now(), order: 0, description: "Long-form blog covering the new features." },
  { id: "t2", projectId: "p_launch", title: "Record 60s product teaser", status: "todo", priority: "medium", assigneeId: "u_priya", dueDate: daysFromNow(5), createdAt: now(), order: 0 },
  { id: "t3", projectId: "p_launch", title: "Update pricing page hero", status: "todo", priority: "low", assigneeId: "u_alex", dueDate: daysFromNow(7), createdAt: now(), order: 1 },
  { id: "t4", projectId: "p_launch", title: "Press list outreach", status: "done", priority: "medium", assigneeId: "u_alex", dueDate: daysFromNow(-1), createdAt: now(), order: 0 },
  { id: "t5", projectId: "p_launch", title: "Finalize launch checklist", status: "in_progress", priority: "high", assigneeId: "u_alex", dueDate: daysFromNow(-2), createdAt: now(), order: 1 },
  { id: "t6", projectId: "p_mobile", title: "Audit current navigation", status: "done", priority: "medium", assigneeId: "u_sam", dueDate: daysFromNow(-3), createdAt: now(), order: 0 },
  { id: "t7", projectId: "p_mobile", title: "Define color tokens", status: "in_progress", priority: "high", assigneeId: "u_jordan", dueDate: daysFromNow(3), createdAt: now(), order: 0 },
  { id: "t8", projectId: "p_mobile", title: "Component library v2", status: "todo", priority: "high", assigneeId: "u_sam", dueDate: daysFromNow(10), createdAt: now(), order: 0 },
  { id: "t9", projectId: "p_growth", title: "Onboarding A/B test setup", status: "in_progress", priority: "medium", assigneeId: "u_priya", dueDate: daysFromNow(4), createdAt: now(), order: 0 },
  { id: "t10", projectId: "p_growth", title: "Referral landing copy", status: "todo", priority: "low", assigneeId: "u_alex", dueDate: daysFromNow(8), createdAt: now(), order: 0 },
];

interface AuthState {
  currentUserId: string | null;
}

interface AppState extends AuthState {
  users: User[];
  projects: Project[];
  tasks: Task[];
  notifications: Notification[];

  // auth
  login: (email: string, _password: string) => User;
  signup: (name: string, email: string, _password: string) => User;
  logout: () => void;

  // projects
  createProject: (data: { name: string; description: string; color?: string }) => Project;
  deleteProject: (id: string) => void;
  addMember: (projectId: string, userId: string, role: Role) => void;
  removeMember: (projectId: string, userId: string) => void;

  // tasks
  createTask: (data: Omit<Task, "id" | "createdAt" | "order">) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  moveTask: (id: string, status: Status, order: number) => void;
  deleteTask: (id: string) => void;

  // notifications
  markAllRead: () => void;

  // selectors
  getRole: (projectId: string, userId?: string | null) => Role | null;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      users: seedUsers,
      projects: seedProjects,
      tasks: seedTasks,
      notifications: [
        { id: "n1", type: "overdue", message: "Finalize launch checklist is overdue", taskId: "t5", projectId: "p_launch", createdAt: now(), read: false },
        { id: "n2", type: "assigned", message: "You were assigned to Draft launch announcement post", taskId: "t1", projectId: "p_launch", createdAt: now(), read: false },
      ],

      login: (email) => {
        const existing = get().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        const user = existing ?? {
          id: `u_${Math.random().toString(36).slice(2, 8)}`,
          name: email.split("@")[0],
          email,
          avatarColor: pick(get().users.length),
        };
        if (!existing) set((s) => ({ users: [...s.users, user] }));
        set({ currentUserId: user.id });
        return user;
      },
      signup: (name, email) => {
        const user: User = {
          id: `u_${Math.random().toString(36).slice(2, 8)}`,
          name,
          email,
          avatarColor: pick(get().users.length),
        };
        set((s) => ({ users: [...s.users, user], currentUserId: user.id }));
        return user;
      },
      logout: () => set({ currentUserId: null }),

      createProject: ({ name, description, color }) => {
        const me = get().currentUserId;
        const project: Project = {
          id: `p_${Math.random().toString(36).slice(2, 8)}`,
          name,
          description,
          color: color ?? pick(get().projects.length),
          createdAt: now(),
          members: me ? [{ userId: me, role: "admin" }] : [],
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      },
      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          tasks: s.tasks.filter((t) => t.projectId !== id),
        })),
      addMember: (projectId, userId, role) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId && !p.members.find((m) => m.userId === userId)
              ? { ...p, members: [...p.members, { userId, role }] }
              : p
          ),
        })),
      removeMember: (projectId, userId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, members: p.members.filter((m) => m.userId !== userId) } : p
          ),
        })),

      createTask: (data) => {
        const order = get().tasks.filter((t) => t.projectId === data.projectId && t.status === data.status).length;
        const task: Task = { ...data, id: `t_${Math.random().toString(36).slice(2, 8)}`, createdAt: now(), order };
        set((s) => ({ tasks: [...s.tasks, task] }));
        if (task.assigneeId) {
          set((s) => ({
            notifications: [
              { id: `n_${Math.random().toString(36).slice(2, 6)}`, type: "assigned", message: `Assigned: ${task.title}`, taskId: task.id, projectId: task.projectId, createdAt: now(), read: false },
              ...s.notifications,
            ],
          }));
        }
        return task;
      },
      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      moveTask: (id, status, order) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return {};
          const others = s.tasks.filter((t) => t.id !== id);
          const updated = { ...task, status, order };
          return { tasks: [...others, updated] };
        }),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      getRole: (projectId, userId) => {
        const uid = userId ?? get().currentUserId;
        if (!uid) return null;
        const project = get().projects.find((p) => p.id === projectId);
        return project?.members.find((m) => m.userId === uid)?.role ?? null;
      },
    }),
    { name: "teamflow-store-v1" }
  )
);

export const useCurrentUser = () => {
  const id = useStore((s) => s.currentUserId);
  const users = useStore((s) => s.users);
  return id ? users.find((u) => u.id === id) ?? null : null;
};
