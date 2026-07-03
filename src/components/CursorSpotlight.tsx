import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface CursorSpotlightProps {
  className?: string;
  size?: number;
  color?: string;
}

/** A soft glow that trails the cursor within its parent (parent must be `relative`). */
export function CursorSpotlight({ className, size = 500, color = "hsl(358 80% 45% / 0.16)" }: CursorSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const springX = useSpring(x, { stiffness: 150, damping: 25 });
  const springY = useSpring(y, { stiffness: 150, damping: 25 });

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      x.set(e.clientX - rect.left);
      y.set(e.clientY - rect.top);
    };
    parent.addEventListener("mousemove", onMove);
    return () => parent.removeEventListener("mousemove", onMove);
  }, [x, y]);

  return (
    <div ref={ref} className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          width: size,
          height: size,
          left: springX,
          top: springY,
          x: "-50%",
          y: "-50%",
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
