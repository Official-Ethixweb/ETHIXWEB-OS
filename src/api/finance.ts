import { api } from "@/lib/api";
import { normTransaction } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { FinanceCategory, FinanceSummary, Transaction, TransactionType } from "@/types";

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  currency?: string;
  category: FinanceCategory;
  description: string;
  date: string;
  recurring?: boolean;
}

export const financeApi = {
  ...makeCrudExtensions<Transaction>("finance", normTransaction),
  async list(params?: { type?: string; category?: string; from?: string; to?: string; archived?: boolean }): Promise<Transaction[]> {
    const { data } = await api.get("/finance", { params });
    return (data.transactions ?? []).map(normTransaction);
  },
  async create(input: TransactionInput): Promise<Transaction> {
    const { data } = await api.post("/finance", input);
    return normTransaction(data.transaction);
  },
  async update(id: string, input: Partial<TransactionInput>): Promise<Transaction> {
    const { data } = await api.patch(`/finance/${id}`, input);
    return normTransaction(data.transaction);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/finance/${id}`);
  },
  async summary(params?: { month?: string; year?: string }): Promise<FinanceSummary> {
    const { data } = await api.get("/finance/summary", { params });
    return data as FinanceSummary;
  },
  async downloadReportPdf(params: { month?: string; year?: string }, filename: string): Promise<void> {
    const res = await api.get("/finance/report/pdf", { params, responseType: "blob" });
    const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
