import { api } from "@/lib/api";
import { normDepartment } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { DepartmentRecord } from "@/types";

export interface DepartmentInput {
  name: string;
  description?: string;
  manager?: string | null;
  color?: string;
}

export const departmentsApi = {
  ...makeCrudExtensions<DepartmentRecord>("departments", normDepartment),
  async list(params?: { archived?: boolean }): Promise<DepartmentRecord[]> {
    const { data } = await api.get("/departments", { params });
    return (data.departments ?? []).map(normDepartment);
  },
  async get(id: string): Promise<DepartmentRecord> {
    const { data } = await api.get(`/departments/${id}`);
    return normDepartment(data.department);
  },
  async create(input: DepartmentInput): Promise<DepartmentRecord> {
    const { data } = await api.post("/departments", input);
    return normDepartment(data.department);
  },
  async update(id: string, input: Partial<DepartmentInput>): Promise<DepartmentRecord> {
    const { data } = await api.patch(`/departments/${id}`, input);
    return normDepartment(data.department);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  },
};
