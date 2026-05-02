import { Navigate } from "react-router-dom";
import { useStore } from "@/store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const userId = useStore((s) => s.currentUserId);
  if (!userId) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
