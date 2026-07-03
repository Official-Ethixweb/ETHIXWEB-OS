import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  (import.meta.env.PROD ? "" : "http://localhost:4000");

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  // Sends the HttpOnly refresh-token cookie on every request (needed for
  // /auth/refresh and /auth/logout); every other route ignores it.
  withCredentials: true,
});

// The access token lives in memory only — never localStorage/sessionStorage —
// so it isn't readable by an XSS payload that persists across page loads.
// Session persistence ("remember me") comes from the HttpOnly refresh cookie
// instead, restored via a silent /auth/refresh call on app load.
let accessToken: string | null = null;

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string | null) {
  accessToken = token;
}

function unwrapEnvelope(data: unknown): unknown {
  if (data && typeof data === "object" && "success" in data && "data" in data) {
    return (data as { data: unknown }).data;
  }
  return data;
}

api.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, null, { withCredentials: true })
      .then((r) => {
        const body = unwrapEnvelope(r.data) as { token?: string } | null;
        accessToken = body?.token ?? null;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const AUTH_ENDPOINTS_NO_RETRY = ["/auth/login", "/auth/signup", "/auth/refresh", "/auth/login/verify-2fa"];

api.interceptors.response.use(
  (r) => {
    r.data = unwrapEnvelope(r.data);
    return r;
  },
  async (error: AxiosError<{ error?: string; message?: string }>) => {
    const status = error.response?.status;
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = originalRequest?.url || "";
    const isAuthNoRetry = AUTH_ENDPOINTS_NO_RETRY.some((p) => url.includes(p));

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthNoRetry) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? ({} as InternalAxiosRequestConfig["headers"]);
        originalRequest.headers.set?.("Authorization", `Bearer ${newToken}`);
        return api(originalRequest);
      }
      accessToken = null;
      onUnauthorized?.();
      return Promise.reject(error);
    }

    if (status === 401) {
      accessToken = null;
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

// Attempts to restore a session from the refresh cookie (called once on app
// load, since the access token itself never survives a page reload).
export async function silentRefresh(): Promise<string | null> {
  return refreshAccessToken();
}

// --- Error message extraction ---
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as AxiosError<{ error?: string; message?: string; details?: unknown }>;
  const data = e?.response?.data;
  if (data) {
    if (Array.isArray(data.details) && data.details.length) {
      const first = data.details[0] as { message?: string } | string;
      if (typeof first === "string") return first;
      if (first?.message) return first.message;
    }
    if (data.error) return data.error;
    if (data.message) return data.message;
  }
  return e?.message || fallback;
}

export function toastApiError(err: unknown, fallback = "Something went wrong") {
  toast.error(apiErrorMessage(err, fallback));
}
