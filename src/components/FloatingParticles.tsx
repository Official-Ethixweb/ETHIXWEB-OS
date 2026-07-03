import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface FloatingParticlesProps {
  count?: number;
  className?: string;
}

/** Slow-drifting ambient particles for premium hero/login backgrounds. */
export function FloatingParticles({ count = 24, className }: FloatingParticlesProps) {
  const reduceMotion = useReducedMotion();
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 14 + Math.random() * 16,
        delay: -Math.random() * 20,
        opacity: 0.15 + Math.random() * 0.35,
      })),
    [count]
  );

  if (reduceMotion) return null;

  return (
    <div className={className} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-primary-glow"
          style={{ left: `${p.left}%`, width: p.size, height: p.size, bottom: -20, opacity: p.opacity }}
          animate={{ y: ["0vh", "-110vh"], opacity: [0, p.opacity, p.opacity, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}
