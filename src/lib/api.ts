import axios, { AxiosError } from "axios";
import { toast } from "sonner";

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:4000";

export const TOKEN_KEY = "teamflow_token";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// --- Auth token helpers ---
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

// --- Interceptors ---
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status;
    if (status === 401) {
      setToken(null);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

// --- Error message extraction ---
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as AxiosError<{ error?: string }>;
  return e?.response?.data?.error || e?.message || fallback;
}

export function toastApiError(err: unknown, fallback = "Something went wrong") {
  toast.error(apiErrorMessage(err, fallback));
}
