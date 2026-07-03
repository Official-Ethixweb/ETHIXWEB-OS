import { useMemo } from "react";
import type { Employee, Notification } from "@/types";

const WINDOW_DAYS = 14;

function nextOccurrence(date: Date, from: Date): Date {
  const next = new Date(from.getFullYear(), date.getMonth(), date.getDate());
  if (next < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    next.setFullYear(from.getFullYear() + 1);
  }
  return next;
}

/** Derives upcoming-birthday / work-anniversary notifications from employee records. */
export function useEmployeeNotifications(employees: Employee[]): Notification[] {
  return useMemo(() => {
    const now = new Date();
    const out: Notification[] = [];

    for (const e of employees) {
      if (e.dateOfBirth) {
        const occ = nextOccurrence(new Date(e.dateOfBirth), now);
        const days = Math.round((occ.getTime() - now.getTime()) / 86400000);
        if (days >= 0 && days <= WINDOW_DAYS) {
          out.push({
            id: `birthday-${e.id}`,
            type: "birthday",
            message: days === 0 ? `${e.name}'s birthday is today 🎂` : `${e.name}'s birthday in ${days} day${days === 1 ? "" : "s"}`,
            employeeId: e.id,
            createdAt: occ.toISOString(),
            read: false,
          });
        }
      }
      if (e.joiningDate) {
        const occ = nextOccurrence(new Date(e.joiningDate), now);
        const days = Math.round((occ.getTime() - now.getTime()) / 86400000);
        if (days >= 0 && days <= WINDOW_DAYS) {
          out.push({
            id: `anniversary-${e.id}`,
            type: "anniversary",
            message: days === 0 ? `${e.name}'s work anniversary is today 🎉` : `${e.name}'s work anniversary in ${days} day${days === 1 ? "" : "s"}`,
            employeeId: e.id,
            createdAt: occ.toISOString(),
            read: false,
          });
        }
      }
    }

    return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [employees]);
}
