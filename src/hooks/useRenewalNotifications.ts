import { useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import type { Domain, Notification, ServerAsset, Subscription } from "@/types";

const WINDOW_DAYS = 30;

/** Derives upcoming-renewal notifications from subscriptions, domains, and servers. */
export function useRenewalNotifications(subscriptions: Subscription[], domains: Domain[], servers: ServerAsset[]): Notification[] {
  return useMemo(() => {
    const now = new Date();
    const out: Notification[] = [];

    for (const s of subscriptions) {
      if (!s.renewalDate) continue;
      const days = differenceInCalendarDays(new Date(s.renewalDate), now);
      if (days >= 0 && days <= WINDOW_DAYS) {
        out.push({
          id: `renewal-sub-${s.id}`,
          type: "renewal",
          message: days === 0 ? `${s.vendor} renews today` : `${s.vendor} renews in ${days} day${days === 1 ? "" : "s"}`,
          href: "/app/subscriptions",
          createdAt: s.renewalDate,
          read: false,
        });
      }
    }

    for (const d of domains) {
      if (!d.renewalDate) continue;
      const days = differenceInCalendarDays(new Date(d.renewalDate), now);
      if (days >= 0 && days <= WINDOW_DAYS) {
        out.push({
          id: `renewal-dom-${d.id}`,
          type: "renewal",
          message: days === 0 ? `${d.domainName} renews today` : `${d.domainName} renews in ${days} day${days === 1 ? "" : "s"}`,
          href: "/app/domains",
          createdAt: d.renewalDate,
          read: false,
        });
      }
    }

    for (const s of servers) {
      if (!s.renewalDate) continue;
      const days = differenceInCalendarDays(new Date(s.renewalDate), now);
      if (days >= 0 && days <= WINDOW_DAYS) {
        out.push({
          id: `renewal-srv-${s.id}`,
          type: "renewal",
          message: days === 0 ? `${s.label} renews today` : `${s.label} renews in ${days} day${days === 1 ? "" : "s"}`,
          href: "/app/servers",
          createdAt: s.renewalDate,
          read: false,
        });
      }
    }

    return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [subscriptions, domains, servers]);
}
