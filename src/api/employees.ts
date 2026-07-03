import { api } from "@/lib/api";
import { normEmployee } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { CompanyRole, Department, Employee, EmployeeStatus, EmploymentType } from "@/types";

export interface CreateEmployeeInput {
  name: string;
  email: string;
  phone?: string;
  department: Department;
  designation: string;
  employmentType?: EmploymentType;
  companyRole?: CompanyRole;
  joiningDate: string;
  dateOfBirth?: string | null;
  status?: EmployeeStatus;
  salary?: { amount: number; currency?: string };
  skills?: string[];
  experienceYears?: number;
  notes?: string;
}

export const employeesApi = {
  ...makeCrudExtensions<Employee>("employees", normEmployee),
  async list(params?: { department?: string; status?: string; q?: string; archived?: boolean }): Promise<Employee[]> {
    const { data } = await api.get("/employees", { params });
    return (data.employees ?? []).map(normEmployee);
  },
  async get(id: string): Promise<Employee> {
    const { data } = await api.get(`/employees/${id}`);
    return normEmployee(data.employee);
  },
  async create(input: CreateEmployeeInput): Promise<Employee> {
    const { data } = await api.post("/employees", input);
    return normEmployee(data.employee);
  },
  async update(id: string, input: Partial<CreateEmployeeInput>): Promise<Employee> {
    const { data } = await api.patch(`/employees/${id}`, input);
    return normEmployee(data.employee);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  },
  async uploadPhoto(id: string, file: File): Promise<Employee> {
    const form = new FormData();
    form.append("photo", file);
    const { data } = await api.post(`/employees/${id}/photo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return normEmployee(data.employee);
  },
  async uploadDocument(id: string, file: File, type: string): Promise<Employee> {
    const form = new FormData();
    form.append("document", file);
    form.append("type", type);
    const { data } = await api.post(`/employees/${id}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return normEmployee(data.employee);
  },
};
