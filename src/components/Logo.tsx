import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export function Logo({ className, showText = true, size = 40 }: LogoProps) {
  const radius = Math.round(size * 0.24);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="shrink-0 overflow-hidden grid place-items-center border border-white/[0.08]"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: "linear-gradient(135deg, hsl(358 62% 28%) 0%, hsl(358 85% 44%) 100%)",
          boxShadow: `0 ${Math.round(size * 0.1)}px ${Math.round(size * 0.4)}px hsl(358 80% 30% / 0.5), 0 0 0 1px hsl(0 0% 100% / 0.06) inset`,
        }}
      >
        <img
          src="/brand/emblem-transparent.png"
          alt="ETHIXWEB"
          width={size}
          height={size}
          className="h-[80%] w-[80%] object-contain"
          style={{ imageRendering: "-webkit-optimize-contrast" }}
          draggable={false}
        />
      </div>
      {showText && (
        <div className="leading-tight">
          <div className="font-bold tracking-tight" style={{ fontSize: Math.max(size * 0.34, 15) }}>ETHIXWEB</div>
          <div className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Operating System</div>
        </div>
      )}
    </div>
  );
}
