import { api } from "@/lib/api";
import { normUser } from "./normalize";
import type { User } from "@/types";

interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  async signup(name: string, email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post("/auth/signup", { name, email, password });
    return { token: data.token, user: normUser(data.user)! };
  },
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post("/auth/login", { email, password });
    return { token: data.token, user: normUser(data.user)! };
  },
  async me(): Promise<User> {
    const { data } = await api.get("/auth/me");
    return normUser(data.user)!;
  },
  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
  },
};
