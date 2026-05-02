import type { Member, Project, Task, User } from "@/types";

const COLORS = ["#6366F1", "#A855F7", "#22D3EE", "#F472B6", "#34D399", "#FB923C"];

export function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

interface RawUser {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  avatarColor?: string;
}

export function normUser(raw: RawUser | string | null | undefined): User | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { id: raw, name: "Unknown", email: "", avatarColor: colorFor(raw) };
  }
  const id = String(raw._id ?? raw.id ?? "");
  if (!id) return null;
  return {
    id,
    name: raw.name ?? "Unknown",
    email: raw.email ?? "",
    avatarColor: raw.avatarColor ?? colorFor(id),
  };
}

interface RawMember {
  user: RawUser | string;
  role: "admin" | "member";
}

interface RawProject {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  color?: string;
  createdAt?: string;
  owner?: RawUser | string;
  members?: RawMember[];
}

export function normProject(raw: RawProject): Project {
  const id = String(raw._id ?? raw.id ?? "");
  const ownerUser = normUser(raw.owner);
  const members: Member[] = (raw.members ?? []).map((m) => {
    const u = normUser(m.user);
    return {
      userId: u?.id ?? (typeof m.user === "string" ? m.user : ""),
      user: u ?? undefined,
      role: m.role,
    };
  });
  // Ensure owner is also surfaced as an admin member if not already present
  if (ownerUser && !members.some((m) => m.userId === ownerUser.id)) {
    members.unshift({ userId: ownerUser.id, user: ownerUser, role: "admin" });
  }
  return {
    id,
    name: raw.name,
    description: raw.description ?? "",
    color: raw.color || colorFor(id),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    ownerId: ownerUser?.id,
    owner: ownerUser ?? undefined,
    members,
  };
}

interface RawTask {
  _id?: string;
  id?: string;
  project: string;
  title: string;
  description?: string;
  assignee?: RawUser | string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string | null;
  createdAt?: string;
  order?: number;
}

export function normTask(raw: RawTask): Task {
  const assignee = normUser(raw.assignee ?? null);
  return {
    id: String(raw._id ?? raw.id ?? ""),
    projectId: String(raw.project),
    title: raw.title,
    description: raw.description ?? "",
    assigneeId: assignee?.id ?? null,
    assignee,
    status: raw.status,
    priority: raw.priority,
    dueDate: raw.dueDate ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    order: raw.order ?? 0,
  };
}
