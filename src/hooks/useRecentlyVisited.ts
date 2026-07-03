import { useEffect, useState } from "react";

const STORAGE_KEY = "ew_recently_visited";
const MAX_ENTRIES = 5;

export interface RecentVisit {
  path: string;
  label: string;
  color?: string;
}

function read(): RecentVisit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentVisit[]) : [];
  } catch {
    return [];
  }
}

/** Tracks the last few project/employee detail pages visited, client-side only. */
export function useRecentlyVisited(path: string, label: string | null, color?: string) {
  const [visits, setVisits] = useState<RecentVisit[]>(() => read());

  useEffect(() => {
    if (!label) return;
    setVisits((prev) => {
      const next = [{ path, label, color }, ...prev.filter((v) => v.path !== path)].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, label]);

  return visits;
}
