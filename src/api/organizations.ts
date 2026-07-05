import { api } from "@/lib/api";
import { normOrganization } from "./normalize";
import type { Organization, ToggleableModule } from "@/types";

export interface OrgSettingsInput {
  name?: string;
  timezone?: string;
  currency?: string;
  primaryColor?: string;
  enabledModules?: ToggleableModule[];
}

export const organizationsApi = {
  async getMe(): Promise<Organization> {
    const { data } = await api.get("/organizations/me");
    return normOrganization(data.organization)!;
  },
  async updateMe(input: OrgSettingsInput): Promise<Organization> {
    const { data } = await api.patch("/organizations/me", input);
    return normOrganization(data.organization)!;
  },
  async uploadLogo(file: File): Promise<Organization> {
    const form = new FormData();
    form.append("logo", file);
    const { data } = await api.post("/organizations/me/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
    return normOrganization(data.organization)!;
  },
  async updateIpAllowlist(ipAllowlist: string[]): Promise<string[]> {
    const { data } = await api.patch("/organizations/me/ip-allowlist", { ipAllowlist });
    return data.ipAllowlist ?? [];
  },
};
