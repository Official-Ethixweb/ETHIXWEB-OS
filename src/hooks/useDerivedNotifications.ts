import { useMemo } from "react";
import { isAfter } from "date-fns";
import type { Notification, Project, Task } from "@/types";
import { useAuth } from "@/context/AuthContext";

/**
 * Derive notifications from current task data:
 *  - Tasks assigned to me that are still open
 *  - Tasks overdue and not done
 */
export function useDerivedNotifications(tasks: Task[], projects: Project[]): Notification[] {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return [];
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const out: Notification[] = [];
    const now = new Date();

    for (const t of tasks) {
      const project = projectMap.get(t.projectId);
      if (!project) continue;

      if (t.assigneeId === user.id && t.status !== "done") {
        out.push({
          id: `assigned-${t.id}`,
          type: "assigned",
          message: `Assigned to you: ${t.title}`,
          taskId: t.id,
          projectId: t.projectId,
          createdAt: t.createdAt,
          read: false,
        });
      }

      if (t.dueDate && t.status !== "done" && isAfter(now, new Date(t.dueDate))) {
        out.push({
          id: `overdue-${t.id}`,
          type: "overdue",
          message: `Overdue: ${t.title}`,
          taskId: t.id,
          projectId: t.projectId,
          createdAt: t.dueDate,
          read: false,
        });
      }
    }

    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  }, [tasks, projects, user]);
}
