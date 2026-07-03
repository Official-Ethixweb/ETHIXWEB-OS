import { api } from "@/lib/api";
import { normDomain } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { Domain, DomainStatus } from "@/types";

export interface DomainInput {
  domainName: string;
  registrar: string;
  dns?: string;
  sslExpiry?: string | null;
  autoRenew?: boolean;
  cost: { amount: number; currency?: string };
  renewalDate: string;
  owner?: string | null;
  status?: DomainStatus;
  notes?: string;
}

export const domainsApi = {
  ...makeCrudExtensions<Domain>("domains", normDomain),
  async list(params?: { status?: string; q?: string; archived?: boolean }): Promise<Domain[]> {
    const { data } = await api.get("/domains", { params });
    return (data.domains ?? []).map(normDomain);
  },
  async get(id: string): Promise<Domain> {
    const { data } = await api.get(`/domains/${id}`);
    return normDomain(data.domain);
  },
  async create(input: DomainInput): Promise<Domain> {
    const { data } = await api.post("/domains", input);
    return normDomain(data.domain);
  },
  async update(id: string, input: Partial<DomainInput>): Promise<Domain> {
    const { data } = await api.patch(`/domains/${id}`, input);
    return normDomain(data.domain);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/domains/${id}`);
  },
};
