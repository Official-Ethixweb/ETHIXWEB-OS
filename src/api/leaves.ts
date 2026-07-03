import { api } from "@/lib/api";
import { normLeave } from "./normalize";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/types";

export const leavesApi = {
  async list(params?: { employee?: string; status?: string }): Promise<LeaveRequest[]> {
    const { data } = await api.get("/leaves", { params });
    return (data.leaves ?? []).map(normLeave);
  },
  async request(input: { employee: string; type?: LeaveType; startDate: string; endDate: string; reason?: string }): Promise<LeaveRequest> {
    const { data } = await api.post("/leaves", input);
    return normLeave(data.leave);
  },
  async review(id: string, status: Extract<LeaveStatus, "approved" | "rejected">): Promise<LeaveRequest> {
    const { data } = await api.patch(`/leaves/${id}`, { status });
    return normLeave(data.leave);
  },
};
