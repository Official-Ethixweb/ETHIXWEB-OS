import { differenceInCalendarDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RenewalBadgeProps {
  date: string;
  className?: string;
}

/** Color-coded "days remaining" badge for renewal-style dates (red <7d, amber <30d, green otherwise). */
export function RenewalBadge({ date, className }: RenewalBadgeProps) {
  const days = differenceInCalendarDays(new Date(date), new Date());
  const overdue = days < 0;
  const tone = overdue || days <= 7 ? "destructive" : days <= 30 ? "warning" : "success";
  const label = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d left`;

  return (
    <Badge
      variant="outline"
      className={cn(
        tone === "destructive" && "bg-destructive/15 text-destructive border-destructive/30",
        tone === "warning" && "bg-warning/15 text-warning border-warning/30",
        tone === "success" && "bg-success/15 text-success border-success/30",
        className
      )}
    >
      {label}
    </Badge>
  );
}
