import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export function Logo({ className, showText = true, size = 32 }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg width={size} height={size} viewBox="0 0 64 64" className="shrink-0 drop-shadow-[0_0_18px_hsl(var(--primary)/0.45)]">
        <defs>
          <linearGradient id="tf-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(250 95% 65%)" />
            <stop offset="0.55" stopColor="hsl(270 100% 72%)" />
            <stop offset="1" stopColor="hsl(190 95% 60%)" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#tf-grad)" />
        <path
          d="M16 22h32M22 22v22M42 22v22M30 32h12"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showText && (
        <div className="leading-tight">
          <div className="font-bold tracking-tight text-[1.05rem]">TeamFlow</div>
          <div className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Organize · Deliver</div>
        </div>
      )}
    </div>
  );
}
