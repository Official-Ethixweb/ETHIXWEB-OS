import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/api/tasks";
import { projectsApi } from "@/api/projects";
import type { Task } from "@/types";

/**
 * Aggregates tasks across every project the user belongs to.
 * Uses one task query per project.
 */
export function useAllTasks() {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const projects = projectsQuery.data ?? [];

  const tasksQueries = useQuery({
    queryKey: ["all-tasks", projects.map((p) => p.id).sort().join(",")],
    enabled: projectsQuery.isSuccess,
    queryFn: async () => {
      if (projects.length === 0) return [] as Task[];
      const results = await Promise.all(
        projects.map((p) =>
          tasksApi.listByProject(p.id).catch(() => [] as Task[])
        )
      );
      return results.flat();
    },
  });

  return {
    projects,
    tasks: tasksQueries.data ?? [],
    isLoading: projectsQuery.isLoading || tasksQueries.isLoading,
    isError: projectsQuery.isError || tasksQueries.isError,
  };
}
