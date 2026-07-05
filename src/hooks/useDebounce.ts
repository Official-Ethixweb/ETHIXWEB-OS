import { useEffect, useRef, useState, useCallback } from "react";

/** Returns `value` after `delay` ms of inactivity. */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Returns a stable function that delays invoking `fn` until `delay` ms have
 * passed since the last call — later calls reset the timer. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 250): (...args: A) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  return useCallback(
    (...args: A) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  );
}
