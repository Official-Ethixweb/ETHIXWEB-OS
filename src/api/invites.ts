import { api } from "@/lib/api";
import { normInvite } from "./normalize";
import type { CompanyRole, Invite } from "@/types";

export const invitesApi = {
  async list(): Promise<Invite[]> {
    const { data } = await api.get("/invites");
    return (data.invites ?? []).map(normInvite);
  },
  async create(email: string, companyRole: CompanyRole): Promise<{ invite: Invite; inviteUrl: string }> {
    const { data } = await api.post("/invites", { email, companyRole });
    return { invite: normInvite(data.invite), inviteUrl: data.inviteUrl };
  },
  async revoke(id: string): Promise<void> {
    await api.delete(`/invites/${id}`);
  },
  async preview(token: string): Promise<{ organizationName: string; email: string; companyRole: CompanyRole }> {
    const { data } = await api.get(`/invites/${token}/preview`);
    return data;
  },
};
