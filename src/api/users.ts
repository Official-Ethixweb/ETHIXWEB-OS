import { api } from "@/lib/api";
import { normUser } from "./normalize";
import type { User } from "@/types";

export const usersApi = {
  async list(): Promise<User[]> {
    const { data } = await api.get("/users");
    return (data.users ?? []).map(normUser).filter(Boolean) as User[];
  },
  async search(q: string): Promise<User[]> {
    const { data } = await api.get("/users/search", { params: { q } });
    return (data.users ?? []).map(normUser).filter(Boolean) as User[];
  },
};
