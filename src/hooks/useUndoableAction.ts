import { useCallback, useRef } from "react";
import { toast } from "sonner";

interface UndoableOptions {
  /** Toast message shown immediately, e.g. "3 assets deleted". */
  message: string;
  /** How long the user has to hit Undo before the real action fires. */
  delayMs?: number;
  /** The real (usually destructive) action — only runs if not undone in time. */
  onCommit: () => Promise<void> | void;
  /** Called immediately if the user clicks Undo, to restore optimistic UI state. */
  onUndo?: () => void;
}

/**
 * Gmail-style "delayed commit" undo: the destructive action doesn't actually
 * run until `delayMs` passes with no Undo click, so undo is always correct
 * (no reconstruction of deleted data needed) at the cost of a short delay
 * before the change is durable server-side.
 */
export function useUndoableAction() {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const run = useCallback((opts: UndoableOptions) => {
    const id = Math.random().toString(36).slice(2);
    const delay = opts.delayMs ?? 5000;
    let undone = false;

    const timeout = setTimeout(async () => {
      timers.current.delete(id);
      if (undone) return;
      try {
        await opts.onCommit();
      } catch {
        toast.error("Something went wrong finishing that action — refresh to see the current state");
      }
    }, delay);

    timers.current.set(id, timeout);

    toast(opts.message, {
      duration: delay,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          const t = timers.current.get(id);
          if (t) {
            clearTimeout(t);
            timers.current.delete(id);
          }
          opts.onUndo?.();
        },
      },
    });
  }, []);

  return { run };
}
