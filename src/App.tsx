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
import { RequireCompanyRole } from "@/components/RequireCompanyRole";
import { AuthProvider } from "@/context/AuthContext";
import { ASSET_COMPANY_ROLES, FINANCE_COMPANY_ROLES, OPS_COMPANY_ROLES, OWNER_COMPANY_ROLES } from "@/types";

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
                  <Route path="payroll" element={<RequireCompanyRole roles={FINANCE_COMPANY_ROLES}><Payroll /></RequireCompanyRole>} />
                  <Route path="subscriptions" element={<RequireCompanyRole roles={OPS_COMPANY_ROLES}><Subscriptions /></RequireCompanyRole>} />
                  <Route path="domains" element={<RequireCompanyRole roles={OPS_COMPANY_ROLES}><Domains /></RequireCompanyRole>} />
                  <Route path="servers" element={<RequireCompanyRole roles={OPS_COMPANY_ROLES}><Servers /></RequireCompanyRole>} />
                  <Route path="finance" element={<RequireCompanyRole roles={FINANCE_COMPANY_ROLES}><Finance /></RequireCompanyRole>} />
                  <Route path="team" element={<RequireCompanyRole roles={OWNER_COMPANY_ROLES}><Team /></RequireCompanyRole>} />
                  <Route path="assets" element={<RequireCompanyRole roles={ASSET_COMPANY_ROLES}><Assets /></RequireCompanyRole>} />
                  <Route path="clients" element={<RequireCompanyRole roles={OPS_COMPANY_ROLES}><Clients /></RequireCompanyRole>} />
                  <Route path="vendors" element={<RequireCompanyRole roles={OPS_COMPANY_ROLES}><Vendors /></RequireCompanyRole>} />
                  <Route path="departments" element={<Departments />} />
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
