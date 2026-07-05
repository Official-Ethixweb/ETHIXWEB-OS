import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, FileText, FolderKanban, ListChecks, LogOut, Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PortalLayout() {
  const { user: me, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const perms = useMemo(() => me?.permissions ?? [], [me?.permissions]);
  const isVendor = me?.userType === "vendor";
  const isClient = me?.userType === "client";

  const nav = useMemo(() => {
    const items: { to: string; label: string; icon: typeof FolderKanban }[] = [
      { to: "/portal", label: "Overview", icon: FolderKanban },
    ];
    if (isVendor && perms.includes("tasks.view_assigned")) {
      items.push({ to: "/portal/tasks", label: "Tasks", icon: CheckSquare });
    }
    if (isClient && perms.includes("milestones.view")) {
      items.push({ to: "/portal/milestones", label: "Milestones", icon: ListChecks });
    }
    if (perms.includes("documents.view")) {
      items.push({ to: "/portal/documents", label: "Documents", icon: FileText });
    }
    if (perms.includes("invoices.view")) {
      items.push({ to: "/portal/invoices", label: "Invoices", icon: Receipt });
    }
    return items;
  }, [perms, isVendor, isClient]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  useEffect(() => {
    // no-op placeholder for future per-route side effects (mirrors AppLayout's shape)
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 glass-strong sticky top-0 h-screen">
        <div className="p-5">
          <Logo />
          <div className="text-xs text-muted-foreground truncate mt-1 pl-0.5">
            {me?.organization?.name} · {isVendor ? "Vendor Portal" : "Client Portal"}
          </div>
        </div>
        <nav className="px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon, }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/portal"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "text-foreground bg-gradient-subtle shadow-card" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="p-3 border-t border-border/60">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-secondary/60 transition-colors">
                <UserAvatar user={me} size={34} />
                <div className="text-left min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{me?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{me?.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass border-b border-border/60 md:hidden">
          <div className="flex items-center gap-3 px-4 h-16">
            <Logo showText={false} />
            <div className="text-sm font-medium truncate">{me?.organization?.name}</div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <button onClick={handleLogout} className="h-9 w-9 rounded-lg hover:bg-secondary/60 inline-flex items-center justify-center transition-colors" aria-label="Log out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="flex overflow-x-auto no-scrollbar px-3 pb-2 gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/portal"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <header className="hidden md:flex sticky top-0 z-30 glass border-b border-border/60 items-center justify-end px-8 h-16">
          <ThemeToggle />
        </header>

        <div className="flex-1 px-4 md:px-8 py-6 md:py-8">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
