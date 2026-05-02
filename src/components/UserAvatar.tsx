import { cn } from "@/lib/utils";
import type { User } from "@/types";

interface AvatarProps {
  user?: Pick<User, "name" | "avatarColor"> | null;
  size?: number;
  className?: string;
  ring?: boolean;
}

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserAvatar({ user, size = 28, className, ring }: AvatarProps) {
  const bg = user?.avatarColor ?? "hsl(var(--muted))";
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        ring && "ring-2 ring-background",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        fontSize: size * 0.4,
      }}
      title={user?.name}
    >
      {initials(user?.name)}
    </div>
  );
}

export function AvatarStack({ users, max = 4, size = 26 }: { users: (User | undefined)[]; max?: number; size?: number }) {
  const visible = users.filter(Boolean).slice(0, max) as User[];
  const extra = users.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((u) => (
        <UserAvatar key={u.id} user={u} size={size} ring />
      ))}
      {extra > 0 && (
        <div
          className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold ring-2 ring-background"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
