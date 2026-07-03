import { useMemo } from "react";
import type { Notification, Payslip } from "@/types";

/** Derives notifications for pending (unpaid) payslips in the current month's payroll run. */
export function usePayrollNotifications(payslips: Payslip[]): Notification[] {
  return useMemo(() => {
    const out: Notification[] = [];

    for (const p of payslips) {
      if (p.paymentStatus === "pending") {
        out.push({
          id: `payroll-${p.id}`,
          type: "payroll",
          message: `Payslip pending for ${p.employee?.name ?? "an employee"} (${p.month})`,
          href: "/app/payroll",
          createdAt: p.generatedAt,
          read: false,
        });
      }
    }

    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [payslips]);
}
