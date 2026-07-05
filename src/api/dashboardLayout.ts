import { api } from "@/lib/api";

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardLayoutData {
  layout: LayoutItem[];
  hiddenWidgets: string[];
}

export const dashboardLayoutApi = {
  async get(): Promise<DashboardLayoutData> {
    const { data } = await api.get("/dashboard-layout");
    return { layout: data.layout ?? [], hiddenWidgets: data.hiddenWidgets ?? [] };
  },
  async save(input: DashboardLayoutData): Promise<DashboardLayoutData> {
    const { data } = await api.put("/dashboard-layout", input);
    return { layout: data.layout ?? [], hiddenWidgets: data.hiddenWidgets ?? [] };
  },
  async reset(): Promise<void> {
    await api.delete("/dashboard-layout");
  },
};
