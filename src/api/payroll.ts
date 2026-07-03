import { api } from "@/lib/api";
import { normPayslip } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { PayLineItem, PaymentStatus, Payslip } from "@/types";

export const payrollApi = {
  ...makeCrudExtensions<Payslip>("payroll", normPayslip),
  async list(params?: { employee?: string; month?: string; archived?: boolean }): Promise<Payslip[]> {
    const { data } = await api.get("/payroll", { params });
    return (data.payslips ?? []).map(normPayslip);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/payroll/${id}`);
  },
  async get(id: string): Promise<Payslip> {
    const { data } = await api.get(`/payroll/${id}`);
    return normPayslip(data.payslip);
  },
  async generate(month: string): Promise<{ payslips: Payslip[]; created: number; skipped: number }> {
    const { data } = await api.post("/payroll/generate", { month });
    return { payslips: (data.payslips ?? []).map(normPayslip), created: data.created, skipped: data.skipped };
  },
  async update(id: string, patch: { bonuses?: PayLineItem[]; deductions?: PayLineItem[]; paymentStatus?: PaymentStatus }): Promise<Payslip> {
    const { data } = await api.patch(`/payroll/${id}`, patch);
    return normPayslip(data.payslip);
  },
  async markPaid(id: string): Promise<Payslip> {
    const { data } = await api.post(`/payroll/${id}/mark-paid`);
    return normPayslip(data.payslip);
  },
  async downloadPdf(id: string, filename: string): Promise<void> {
    const res = await api.get(`/payroll/${id}/pdf`, { responseType: "blob" });
    const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
