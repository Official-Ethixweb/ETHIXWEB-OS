import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LogoRevealProps {
  className?: string;
  size?: number;
  label?: string;
  fullscreen?: boolean;
}

export function LogoReveal({ className, size = 88, label, fullscreen = false }: LogoRevealProps) {
  const content = (
    <div className={cn("relative grid place-items-center", className)}>
      <motion.div
        className="absolute rounded-full"
        style={{ width: size * 1.8, height: size * 1.8, background: "hsl(358 82% 45% / 0.25)", filter: "blur(28px)" }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.9, 1.15, 1], opacity: [0, 0.9, 0.6] }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="relative overflow-hidden grid place-items-center border border-white/[0.08]"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          background: "linear-gradient(135deg, hsl(358 62% 28%) 0%, hsl(358 85% 44%) 100%)",
          boxShadow: `0 ${Math.round(size * 0.1)}px ${Math.round(size * 0.45)}px hsl(358 80% 30% / 0.55), 0 0 0 1px hsl(0 0% 100% / 0.06) inset`,
        }}
        initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.img
          src="/brand/emblem-transparent.png"
          alt="ETHIXWEB"
          className="h-[80%] w-[80%] object-contain"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          draggable={false}
        />
      </motion.div>
      {label && (
        <motion.div
          className="absolute -bottom-8 text-xs uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {label}
        </motion.div>
      )}
    </div>
  );

  if (!fullscreen) return content;

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-background">
      {content}
    </div>
  );
}
