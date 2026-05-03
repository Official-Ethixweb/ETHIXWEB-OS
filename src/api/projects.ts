import { api } from "@/lib/api";
import { normProject } from "./normalize";
import type { Project, Role } from "@/types";

export const projectsApi = {
  async list(): Promise<Project[]> {
    const { data } = await api.get("/projects");
    return (data.projects ?? []).map(normProject);
  },
  async get(projectId: string): Promise<{ project: Project; role: Role }> {
    const { data } = await api.get(`/projects/${projectId}`);
    return { project: normProject(data.project), role: data.role };
  },
  async create(input: { name: string; description?: string; color?: string }): Promise<Project> {
    const { data } = await api.post("/projects", input);
    return normProject(data.project);
  },
  async remove(projectId: string): Promise<void> {
    await api.delete(`/projects/${projectId}`);
  },
  async addMember(projectId: string, email: string, role: Role): Promise<Project> {
    const { data } = await api.post(`/projects/${projectId}/members`, { email, role });
    return normProject(data.project);
  },
  async updateMemberRole(projectId: string, userId: string, role: Role): Promise<Project> {
    const { data } = await api.patch(`/projects/${projectId}/members/${userId}`, { role });
    return normProject(data.project);
  },
  async removeMember(projectId: string, userId: string): Promise<Project> {
    const { data } = await api.delete(`/projects/${projectId}/members/${userId}`);
    return normProject(data.project);
  },
};
