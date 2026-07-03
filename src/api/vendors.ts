import { api } from "@/lib/api";
import { normVendor } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { Vendor, VendorStatus } from "@/types";

export interface VendorInput {
  name: string;
  category?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: VendorStatus;
  contractValue?: { amount: number; currency?: string };
  notes?: string;
}

export const vendorsApi = {
  ...makeCrudExtensions<Vendor>("vendors", normVendor),
  async list(params?: { status?: string; q?: string; archived?: boolean }): Promise<Vendor[]> {
    const { data } = await api.get("/vendors", { params });
    return (data.vendors ?? []).map(normVendor);
  },
  async get(id: string): Promise<Vendor> {
    const { data } = await api.get(`/vendors/${id}`);
    return normVendor(data.vendor);
  },
  async create(input: VendorInput): Promise<Vendor> {
    const { data } = await api.post("/vendors", input);
    return normVendor(data.vendor);
  },
  async update(id: string, input: Partial<VendorInput>): Promise<Vendor> {
    const { data } = await api.patch(`/vendors/${id}`, input);
    return normVendor(data.vendor);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/vendors/${id}`);
  },
};
