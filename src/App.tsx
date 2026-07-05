import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NoiseOverlay } from "@/components/NoiseOverlay";
import Landing from "@/pages/Landing";
import { RequireAuth } from "@/components/RequireAuth";
import { RequirePermission } from "@/components/RequirePermission";
import { AuthProvider } from "@/context/AuthContext";

// Route-level code splitting: keep the marketing Landing page eager (it's the
// most common first paint), lazy-load everything behind auth/navigation so
// the initial bundle stays small.
const AuthForm = lazy(() => import("@/pages/AuthForm").then((m) => ({ default: m.AuthForm })));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AppLayout = lazy(() => import("@/layouts/AppLayout"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const Employees = lazy(() => import("@/pages/Employees"));
const EmployeeDetail = lazy(() => import("@/pages/EmployeeDetail"));
const Payroll = lazy(() => import("@/pages/Payroll"));
const Subscriptions = lazy(() => import("@/pages/Subscriptions"));
const Domains = lazy(() => import("@/pages/Domains"));
const Servers = lazy(() => import("@/pages/Servers"));
const Finance = lazy(() => import("@/pages/Finance"));
const Team = lazy(() => import("@/pages/Team"));
const Assets = lazy(() => import("@/pages/Assets"));
const Clients = lazy(() => import("@/pages/Clients"));
const Vendors = lazy(() => import("@/pages/Vendors"));
const Departments = lazy(() => import("@/pages/Departments"));
const Security = lazy(() => import("@/pages/Security"));
const RolesAdmin = lazy(() => import("@/pages/RolesAdmin"));
const OrgSettings = lazy(() => import("@/pages/OrgSettings"));
const AuditLog = lazy(() => import("@/pages/AuditLog"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function RouteFallback() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NoiseOverlay />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<AuthForm mode="login" />} />
                <Route path="/signup" element={<AuthForm mode="signup" />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/app"
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="projects/:projectId" element={<ProjectDetail />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="employees/:employeeId" element={<EmployeeDetail />} />
                  <Route path="payroll" element={<RequirePermission anyOf={["payroll.view_all", "payroll.manage"]}><Payroll /></RequirePermission>} />
                  <Route path="subscriptions" element={<RequirePermission anyOf={["subscriptions.view"]}><Subscriptions /></RequirePermission>} />
                  <Route path="domains" element={<RequirePermission anyOf={["domains.view"]}><Domains /></RequirePermission>} />
                  <Route path="servers" element={<RequirePermission anyOf={["servers.view"]}><Servers /></RequirePermission>} />
                  <Route path="finance" element={<RequirePermission anyOf={["finance.view"]}><Finance /></RequirePermission>} />
                  <Route path="team" element={<RequirePermission anyOf={["invites.manage"]}><Team /></RequirePermission>} />
                  <Route path="assets" element={<RequirePermission anyOf={["assets.view"]}><Assets /></RequirePermission>} />
                  <Route path="clients" element={<RequirePermission anyOf={["clients.view"]}><Clients /></RequirePermission>} />
                  <Route path="vendors" element={<RequirePermission anyOf={["vendors.view"]}><Vendors /></RequirePermission>} />
                  <Route path="departments" element={<Departments />} />
                  <Route path="security" element={<Security />} />
                  <Route path="admin/roles" element={<RequirePermission anyOf={["roles.manage"]}><RolesAdmin /></RequirePermission>} />
                  <Route path="admin/settings" element={<RequirePermission anyOf={["organization.manage_settings"]}><OrgSettings /></RequirePermission>} />
                  <Route path="admin/audit-log" element={<RequirePermission anyOf={["audit_log.view"]}><AuditLog /></RequirePermission>} />
                </Route>
                <Route path="/dashboard" element={<Navigate to="/app" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
