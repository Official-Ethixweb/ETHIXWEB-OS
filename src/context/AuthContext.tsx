import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { authApi, type LoginResult, type SignupOptions } from "@/api/auth";
import { portalApi } from "@/api/portal";
import { getToken, setOnUnauthorized, silentRefresh } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFactorLogin: (mfaToken: string, code: string) => Promise<User>;
  signup: (name: string, email: string, password: string, opts: SignupOptions) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // The access token is memory-only and never survives a reload, so on
  // mount we try to restore a session from the HttpOnly refresh cookie
  // instead — this is what "stay signed in" now means (see lib/api.ts).
  // /auth/me is staff-only (requireAuth 403s vendor/client accounts), so a
  // 403 here means this session belongs to a portal user — fall back to
  // /portal/me rather than treating it as a failed restore.
  useEffect(() => {
    let active = true;
    silentRefresh()
      .then(async (t) => {
        if (!t) return;
        let u: User;
        try {
          u = await authApi.me();
        } catch (e) {
          if (e instanceof AxiosError && e.response?.status === 403) {
            u = await portalApi.me();
          } else {
            throw e;
          }
        }
        if (active) {
          setTokenState(t);
          setUser(u);
        }
      })
      .catch(() => {
        /* no valid session — stay logged out */
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Global 401 handler
  useEffect(() => {
    setOnUnauthorized(() => {
      setTokenState(null);
      setUser(null);
      qc.clear();
      navigate("/login", { replace: true });
    });
    return () => setOnUnauthorized(null);
  }, [navigate, qc]);

  // /auth/login resolves internal (companyRole/Role-based) permissions, which
  // are empty for a portal account since it has neither — the real portal
  // permission set lives on the Vendor/Client record, only exposed via
  // /portal/me. Re-fetch it here so nav/route gating sees the right grants
  // immediately, without waiting for a page reload to hit the silentRefresh
  // fallback above.
  const resolvePortalUserIfNeeded = async (u: User): Promise<User> =>
    u.userType && u.userType !== "staff" ? portalApi.me() : u;

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    if (!result.mfaRequired) {
      const u = await resolvePortalUserIfNeeded(result.user);
      setTokenState(getToken());
      setUser(u);
      return { ...result, user: u };
    }
    return result;
  }, []);

  const verifyTwoFactorLogin = useCallback(async (mfaToken: string, code: string) => {
    const { user: rawUser } = await authApi.verifyTwoFactorLogin(mfaToken, code);
    const u = await resolvePortalUserIfNeeded(rawUser);
    setTokenState(getToken());
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, opts: SignupOptions) => {
    const { user: u } = await authApi.signup(name, email, password, opts);
    setTokenState(getToken());
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setTokenState(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const logoutAll = useCallback(async () => {
    await authApi.logoutAll();
    setTokenState(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const deleteAccount = useCallback(async (password: string) => {
    await authApi.deleteAccount(password);
    setTokenState(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, verifyTwoFactorLogin, signup, logout, logoutAll, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Backwards-compatible helper used by existing components.
export function useCurrentUser(): User | null {
  return useAuth().user;
}
