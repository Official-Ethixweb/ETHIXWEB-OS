import { useQuery } from "@tanstack/react-query";
import { employeesApi } from "@/api/employees";

export function useEmployees() {
  const query = useQuery({ queryKey: ["employees"], queryFn: () => employeesApi.list() });
  return { employees: query.data ?? [], isLoading: query.isLoading, isError: query.isError };
}
