import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { CompanyRole } from "@/types";

interface RequireCompanyRoleProps {
  roles: CompanyRole[];
  children: React.ReactNode;
}

/** Route-level guard mirroring the server's requireCompanyRole checks, so direct URL access is blocked too, not just the nav link. */
export function RequireCompanyRole({ roles, children }: RequireCompanyRoleProps) {
  const { user } = useAuth();
  if (!user?.companyRole || !roles.includes(user.companyRole)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
