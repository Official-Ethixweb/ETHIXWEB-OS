import { api } from "@/lib/api";
import { normTeam } from "./normalize";
import { makeCrudExtensions } from "./crudExtensions";
import type { Team } from "@/types";

export interface TeamInput {
  name: string;
  department?: string | null;
  lead?: string | null;
  members?: string[];
  description?: string;
}

export const teamsApi = {
  ...makeCrudExtensions<Team>("teams", normTeam),
  async list(params?: { department?: string; archived?: boolean }): Promise<Team[]> {
    const { data } = await api.get("/teams", { params });
    return (data.teams ?? []).map(normTeam);
  },
  async get(id: string): Promise<Team> {
    const { data } = await api.get(`/teams/${id}`);
    return normTeam(data.team);
  },
  async create(input: TeamInput): Promise<Team> {
    const { data } = await api.post("/teams", input);
    return normTeam(data.team);
  },
  async update(id: string, input: Partial<TeamInput>): Promise<Team> {
    const { data } = await api.patch(`/teams/${id}`, input);
    return normTeam(data.team);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/teams/${id}`);
  },
};
