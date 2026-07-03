import { api } from "@/lib/api";
import { normClient } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { Client, ClientStatus } from "@/types";

export interface ClientInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: ClientStatus;
  contractValue?: { amount: number; currency?: string };
  accountManager?: string | null;
  notes?: string;
}

export const clientsApi = {
  ...makeCrudExtensions<Client>("clients", normClient),
  async list(params?: { status?: string; q?: string; archived?: boolean }): Promise<Client[]> {
    const { data } = await api.get("/clients", { params });
    return (data.clients ?? []).map(normClient);
  },
  async get(id: string): Promise<Client> {
    const { data } = await api.get(`/clients/${id}`);
    return normClient(data.client);
  },
  async create(input: ClientInput): Promise<Client> {
    const { data } = await api.post("/clients", input);
    return normClient(data.client);
  },
  async update(id: string, input: Partial<ClientInput>): Promise<Client> {
    const { data } = await api.patch(`/clients/${id}`, input);
    return normClient(data.client);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },
};
