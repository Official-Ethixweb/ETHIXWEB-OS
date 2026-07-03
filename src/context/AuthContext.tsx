import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type SignupOptions } from "@/api/auth";
import { getToken, setOnUnauthorized, setToken } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<User>;
  signup: (name: string, email: string, password: string, opts: SignupOptions) => Promise<User>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [isLoading, setIsLoading] = useState<boolean>(!!getToken());
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Auto-login from existing token
  useEffect(() => {
    let active = true;
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        if (active) {
          setToken(null);
          setTokenState(null);
          setUser(null);
        }
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const { token: t, user: u } = await authApi.login(email, password);
    setToken(t, remember);
    setTokenState(t);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string, opts: SignupOptions) => {
    const { token: t, user: u } = await authApi.signup(name, email, password, opts);
    setToken(t);
    setTokenState(t);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setToken(null);
    setTokenState(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const deleteAccount = useCallback(async (password: string) => {
    await authApi.deleteAccount(password);
    setToken(null);
    setTokenState(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout, deleteAccount }}>
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
