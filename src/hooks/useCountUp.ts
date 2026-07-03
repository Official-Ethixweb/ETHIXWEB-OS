import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

/** Animates a number counting up from 0 to `value` whenever `value` changes. */
export function useCountUp(value: number, duration = 0.8): number {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const controls = animate(prevRef.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prevRef.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}
