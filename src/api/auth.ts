import { api, setToken } from "@/lib/api";
import { normUser } from "./normalize";
import type { User } from "@/types";

interface AuthResponse {
  token: string;
  user: User;
}

export type LoginResult = { mfaRequired: false; token: string; user: User } | { mfaRequired: true; mfaToken: string };

export type SignupOptions =
  | { mode: "create_org"; organizationName: string }
  | { mode: "join_invite"; inviteToken: string };

export interface SessionDevice {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface LoginHistoryEntry {
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

export const authApi = {
  async signup(name: string, email: string, password: string, opts: SignupOptions): Promise<AuthResponse> {
    const body =
      opts.mode === "create_org"
        ? { name, email, password, mode: "create_org", organizationName: opts.organizationName }
        : { name, email, password, mode: "join_invite", inviteToken: opts.inviteToken };
    const { data } = await api.post("/auth/signup", body);
    setToken(data.token);
    return { token: data.token, user: normUser(data.user)! };
  },
  async login(email: string, password: string): Promise<LoginResult> {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.mfaRequired) return { mfaRequired: true, mfaToken: data.mfaToken };
    setToken(data.token);
    return { mfaRequired: false, token: data.token, user: normUser(data.user)! };
  },
  async verifyTwoFactorLogin(mfaToken: string, code: string): Promise<AuthResponse> {
    const { data } = await api.post("/auth/login/verify-2fa", { mfaToken, code });
    setToken(data.token);
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
    } finally {
      setToken(null);
    }
  },
  async logoutAll(): Promise<void> {
    await api.post("/auth/logout-all");
    setToken(null);
  },
  async deleteAccount(password: string): Promise<void> {
    await api.delete("/auth/me", { data: { password } });
    setToken(null);
  },
  async forgotPassword(email: string): Promise<void> {
    await api.post("/auth/forgot-password", { email });
  },
  async resetPassword(token: string, password: string): Promise<void> {
    await api.post("/auth/reset-password", { token, password });
  },
  async resendVerificationEmail(): Promise<void> {
    await api.post("/auth/verify-email/resend");
  },
  async verifyEmail(token: string): Promise<void> {
    await api.post("/auth/verify-email", { token });
  },
  async getSessions(): Promise<{ devices: SessionDevice[]; history: LoginHistoryEntry[] }> {
    const { data } = await api.get("/auth/sessions");
    return data;
  },
  async revokeSession(id: string): Promise<void> {
    await api.post(`/auth/sessions/${id}/revoke`);
  },
  async setupTwoFactor(): Promise<{ otpauth: string; secret: string }> {
    const { data } = await api.post("/auth/2fa/setup");
    return data;
  },
  async verifyTwoFactorSetup(code: string): Promise<{ backupCodes: string[] }> {
    const { data } = await api.post("/auth/2fa/verify", { code });
    return data;
  },
  async disableTwoFactor(password: string): Promise<void> {
    await api.post("/auth/2fa/disable", { password });
  },
};
