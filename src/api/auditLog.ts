import { api } from "@/lib/api";

export interface AuditLogEntry {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normEntry(raw: any): AuditLogEntry {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    actor: raw.actor ? { id: String(raw.actor._id ?? raw.actor.id), name: raw.actor.name, email: raw.actor.email } : null,
    action: raw.action,
    resourceType: raw.resourceType,
    resourceId: raw.resourceId ? String(raw.resourceId) : null,
    metadata: raw.metadata ?? null,
    ip: raw.ip ?? null,
    userAgent: raw.userAgent ?? null,
    createdAt: raw.createdAt,
  };
}

export const auditLogApi = {
  async list(page = 1, limit = 50): Promise<AuditLogPage> {
    const { data } = await api.get("/audit-log", { params: { page, limit } });
    return { entries: (data.entries ?? []).map(normEntry), total: data.total ?? 0, page: data.page ?? page, limit: data.limit ?? limit };
  },
};
