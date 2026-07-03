import { motion } from "framer-motion";
import { useCountUp } from "@/hooks/useCountUp";

interface RadialProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function RadialProgress({ value, size = 96, strokeWidth = 8, label }: RadialProgressProps) {
  const animated = useCountUp(value, 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = value >= 80 ? "hsl(var(--success))" : value >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (value / 100) * circumference }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-2xl font-bold">{animated}</div>
          {label && <div className="text-[0.6rem] text-muted-foreground uppercase tracking-wider -mt-0.5">{label}</div>}
        </div>
      </div>
    </div>
  );
}
