import { api } from "@/lib/api";
import { colorFor } from "./normalize";
import type { User } from "@/types";

export interface PortalProject {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  taskCount: number;
  doneCount: number;
  progressPct: number;
}

export interface PortalTask {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  projectName?: string;
  projectColor?: string;
}

export interface PortalDocument {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  uploadedBy?: { name?: string } | null;
}

export interface PortalInvoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue";
  dueDate: string;
  notes: string;
}

export interface PortalMilestone {
  id: string;
  project: string;
  title: string;
  description: string;
  dueDate: string | null;
  status: "pending" | "in_progress" | "completed";
  approvalStatus: "none" | "pending" | "approved" | "rejected";
}

function normId<T extends { _id?: string; id?: string }>(raw: T): T & { id: string } {
  return { ...raw, id: String(raw._id ?? raw.id ?? "") };
}

export const portalApi = {
  async me(): Promise<User> {
    const { data } = await api.get("/portal/me");
    return {
      id: String(data.id ?? ""),
      name: data.name ?? "",
      email: data.email ?? "",
      avatarColor: colorFor(data.email || data.name || "portal"),
      userType: data.type,
      permissions: data.permissions ?? [],
      organization: data.organizationName
        ? { id: "", name: data.organizationName, slug: "" }
        : undefined,
    };
  },
  async projects(): Promise<PortalProject[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await api.get("/portal/projects");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.projects ?? []).map((p: any) => normId(p));
  },
  async tasks(): Promise<PortalTask[]> {
    const { data } = await api.get("/portal/tasks");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.tasks ?? []).map((t: any) => normId(t));
  },
  async documents(): Promise<PortalDocument[]> {
    const { data } = await api.get("/portal/documents");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.documents ?? []).map((d: any) => normId(d));
  },
  // The stored Document.url points at the internal-staff-only /files proxy,
  // which rejects portal accounts outright — download through this scoped
  // endpoint instead, which streams the same blob after checking the caller
  // was actually granted this specific document.
  async downloadDocument(id: string, filename: string): Promise<void> {
    const { data } = await api.get(`/portal/documents/${id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  async invoices(): Promise<PortalInvoice[]> {
    const { data } = await api.get("/portal/invoices");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.invoices ?? []).map((i: any) => normId(i));
  },
  async milestones(): Promise<PortalMilestone[]> {
    const { data } = await api.get("/portal/milestones");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.milestones ?? []).map((m: any) => normId(m));
  },
  async setMilestoneApproval(id: string, status: "approved" | "rejected"): Promise<PortalMilestone> {
    const { data } = await api.patch(`/portal/milestones/${id}/approval`, { status });
    return normId(data.milestone);
  },
  async previewInvite(type: "vendor" | "client", token: string): Promise<{ name: string; email: string; type: string }> {
    const { data } = await api.get("/portal/invite/preview", { params: { type, token } });
    return data;
  },
  async acceptInvite(input: { type: "vendor" | "client"; token: string; name: string; password: string }): Promise<void> {
    await api.post("/portal/invite/accept", input);
  },
};

export interface PortalPermissionDef {
  key: string;
  label: string;
}

export const portalAdminApi = {
  async permissionDefs(): Promise<{ vendor: PortalPermissionDef[]; client: PortalPermissionDef[] }> {
    const { data } = await api.get("/portal-admin/permissions");
    return data;
  },
  async invite(type: "vendor" | "client", id: string): Promise<string> {
    const { data } = await api.post(`/portal-admin/${type}/${id}/invite`);
    return data.inviteUrl;
  },
  async setPermissions(type: "vendor" | "client", id: string, portalPermissions: string[]): Promise<string[]> {
    const { data } = await api.patch(`/portal-admin/${type}/${id}/permissions`, { portalPermissions });
    return data.portalPermissions;
  },
  async toggle(type: "vendor" | "client", id: string): Promise<boolean> {
    const { data } = await api.patch(`/portal-admin/${type}/${id}/toggle`);
    return data.portalEnabled;
  },
  async documents(params: { project?: string; vendor?: string; client?: string }): Promise<PortalDocument[]> {
    const { data } = await api.get("/portal-admin/documents", { params });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.documents ?? []).map((d: any) => normId(d));
  },
  async uploadDocument(file: File, target: { project?: string; vendor?: string; client?: string }, name?: string): Promise<PortalDocument> {
    const form = new FormData();
    form.append("file", file);
    if (target.project) form.append("project", target.project);
    if (target.vendor) form.append("vendor", target.vendor);
    if (target.client) form.append("client", target.client);
    if (name) form.append("name", name);
    const { data } = await api.post("/portal-admin/documents", form, { headers: { "Content-Type": "multipart/form-data" } });
    return normId(data.document);
  },
  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/portal-admin/documents/${id}`);
  },
  async invoices(params: { vendor?: string; client?: string }): Promise<PortalInvoice[]> {
    const { data } = await api.get("/portal-admin/invoices", { params });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.invoices ?? []).map((i: any) => normId(i));
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createInvoice(input: any): Promise<PortalInvoice> {
    const { data } = await api.post("/portal-admin/invoices", input);
    return normId(data.invoice);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateInvoice(id: string, input: any): Promise<PortalInvoice> {
    const { data } = await api.patch(`/portal-admin/invoices/${id}`, input);
    return normId(data.invoice);
  },
  async deleteInvoice(id: string): Promise<void> {
    await api.delete(`/portal-admin/invoices/${id}`);
  },
  async milestones(project?: string): Promise<PortalMilestone[]> {
    const { data } = await api.get("/portal-admin/milestones", { params: project ? { project } : {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.milestones ?? []).map((m: any) => normId(m));
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createMilestone(input: any): Promise<PortalMilestone> {
    const { data } = await api.post("/portal-admin/milestones", input);
    return normId(data.milestone);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateMilestone(id: string, input: any): Promise<PortalMilestone> {
    const { data } = await api.patch(`/portal-admin/milestones/${id}`, input);
    return normId(data.milestone);
  },
  async deleteMilestone(id: string): Promise<void> {
    await api.delete(`/portal-admin/milestones/${id}`);
  },
};
