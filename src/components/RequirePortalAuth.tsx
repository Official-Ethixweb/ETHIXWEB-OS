import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export function RequirePortalAuth({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !user) return <Navigate to="/login" replace />;
  // A staff account has no business in the portal shell — send it to the
  // main app instead of showing an empty/broken portal for it.
  if (user.userType === "staff" || !user.userType) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
