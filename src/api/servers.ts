import { api } from "@/lib/api";
import { normServer } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { ServerAsset, ServerProvider, ServerStatus, UsageStat } from "@/types";

export interface ServerInput {
  label: string;
  provider: ServerProvider;
  hostingType?: string;
  storage?: Partial<UsageStat>;
  bandwidth?: Partial<UsageStat>;
  cost: { amount: number; currency?: string };
  renewalDate: string;
  status?: ServerStatus;
  notes?: string;
}

export const serversApi = {
  ...makeCrudExtensions<ServerAsset>("servers", normServer),
  async list(params?: { status?: string; provider?: string; q?: string; archived?: boolean }): Promise<ServerAsset[]> {
    const { data } = await api.get("/servers", { params });
    return (data.servers ?? []).map(normServer);
  },
  async get(id: string): Promise<ServerAsset> {
    const { data } = await api.get(`/servers/${id}`);
    return normServer(data.server);
  },
  async create(input: ServerInput): Promise<ServerAsset> {
    const { data } = await api.post("/servers", input);
    return normServer(data.server);
  },
  async update(id: string, input: Partial<ServerInput>): Promise<ServerAsset> {
    const { data } = await api.patch(`/servers/${id}`, input);
    return normServer(data.server);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/servers/${id}`);
  },
};
