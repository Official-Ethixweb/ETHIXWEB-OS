import { api } from "@/lib/api";
import { normSubscription } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { BillingCycle, Subscription, SubscriptionStatus } from "@/types";

export interface SubscriptionInput {
  vendor: string;
  plan?: string;
  cost: { amount: number; currency?: string };
  billingCycle?: BillingCycle;
  renewalDate: string;
  autoRenew?: boolean;
  cardUsed?: string;
  owner?: string | null;
  status?: SubscriptionStatus;
  notes?: string;
}

export const subscriptionsApi = {
  ...makeCrudExtensions<Subscription>("subscriptions", normSubscription),
  async list(params?: { status?: string; billingCycle?: string; q?: string; archived?: boolean }): Promise<Subscription[]> {
    const { data } = await api.get("/subscriptions", { params });
    return (data.subscriptions ?? []).map(normSubscription);
  },
  async get(id: string): Promise<Subscription> {
    const { data } = await api.get(`/subscriptions/${id}`);
    return normSubscription(data.subscription);
  },
  async create(input: SubscriptionInput): Promise<Subscription> {
    const { data } = await api.post("/subscriptions", input);
    return normSubscription(data.subscription);
  },
  async update(id: string, input: Partial<SubscriptionInput>): Promise<Subscription> {
    const { data } = await api.patch(`/subscriptions/${id}`, input);
    return normSubscription(data.subscription);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/subscriptions/${id}`);
  },
  async uploadInvoice(id: string, file: File): Promise<Subscription> {
    const form = new FormData();
    form.append("invoice", file);
    const { data } = await api.post(`/subscriptions/${id}/invoice`, form, { headers: { "Content-Type": "multipart/form-data" } });
    return normSubscription(data.subscription);
  },
};
