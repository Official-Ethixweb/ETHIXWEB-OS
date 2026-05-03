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
  (r) => {
    // Unwrap consistent envelope { success, data, message } if present.
    // Falls back to raw payload for backwards-compat.
    const body = r.data;
    if (body && typeof body === "object" && "success" in body && "data" in body) {
      r.data = (body as { data: unknown }).data;
    }
    return r;
  },
  (error: AxiosError<{ error?: string; message?: string }>) => {
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
