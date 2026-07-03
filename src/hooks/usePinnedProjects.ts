import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ew_pinned_projects";

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Client-side pin/unpin for projects, no backend needed. */
export function usePinnedProjects() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => read());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev].slice(0, 10)));
  }, []);

  return { pinnedIds, isPinned, togglePin };
}
