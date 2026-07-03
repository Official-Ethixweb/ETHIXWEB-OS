import { api } from "@/lib/api";
import { normAsset } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { AssetCategory, AssetRecord, AssetStatus } from "@/types";

export interface AssetInput {
  label: string;
  category?: AssetCategory;
  serialNumber?: string;
  vendor?: string;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  cost?: { amount: number; currency?: string };
  assignedTo?: string | null;
  status?: AssetStatus;
  notes?: string;
}

export const assetsApi = {
  ...makeCrudExtensions<AssetRecord>("assets", normAsset),
  async list(params?: { status?: string; category?: string; assignedTo?: string; q?: string; archived?: boolean }): Promise<AssetRecord[]> {
    const { data } = await api.get("/assets", { params });
    return (data.assets ?? []).map(normAsset);
  },
  async get(id: string): Promise<AssetRecord> {
    const { data } = await api.get(`/assets/${id}`);
    return normAsset(data.asset);
  },
  async create(input: AssetInput): Promise<AssetRecord> {
    const { data } = await api.post("/assets", input);
    return normAsset(data.asset);
  },
  async update(id: string, input: Partial<AssetInput>): Promise<AssetRecord> {
    const { data } = await api.patch(`/assets/${id}`, input);
    return normAsset(data.asset);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/assets/${id}`);
  },
};
