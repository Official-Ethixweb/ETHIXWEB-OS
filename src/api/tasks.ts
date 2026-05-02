import { api } from "@/lib/api";
import { normTask } from "./normalize";
import type { Priority, Status, Task } from "@/types";

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string | null;
  status?: Status;
  priority?: Priority;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  status?: Status;
  priority?: Priority;
  dueDate?: string | null;
}

function toBackendTask(input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  if ("projectId" in out) {
    out.project = out.projectId;
    delete out.projectId;
  }
  if ("assigneeId" in out) {
    out.assignee = out.assigneeId || null;
    delete out.assigneeId;
  }
  if ("dueDate" in out && out.dueDate) {
    // backend expects ISO datetime
    const d = out.dueDate as string;
    out.dueDate = d.includes("T") ? d : new Date(d + "T12:00:00.000Z").toISOString();
  }
  return out;
}

export const tasksApi = {
  async listByProject(projectId: string): Promise<Task[]> {
    const { data } = await api.get("/tasks", { params: { project: projectId } });
    return (data.tasks ?? []).map(normTask);
  },
  async create(input: CreateTaskInput): Promise<Task> {
    const { data } = await api.post("/tasks", toBackendTask(input as unknown as Record<string, unknown>));
    return normTask(data.task);
  },
  async update(id: string, patch: UpdateTaskInput): Promise<Task> {
    const { data } = await api.patch(`/tasks/${id}`, toBackendTask(patch as unknown as Record<string, unknown>));
    return normTask(data.task);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },
};
