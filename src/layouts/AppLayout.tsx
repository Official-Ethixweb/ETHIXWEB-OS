import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, FolderKanban, LayoutDashboard, LogOut, Plus, Search, Settings } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import { projectsApi } from "@/api/projects";
import { useAllTasks } from "@/hooks/useAllTasks";
import { useDerivedNotifications } from "@/hooks/useDerivedNotifications";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
];

export default function AppLayout() {
  const { user: me, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const { tasks } = useAllTasks();
  const notifications = useDerivedNotifications(tasks, projects);
  const unread = notifications.length;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 glass-strong sticky top-0 h-screen">
        <div className="p-5">
          <NavLink to="/app"><Logo /></NavLink>
        </div>
        <nav className="px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-subtle text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 mt-6 mb-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">Projects</div>
        <div className="px-3 space-y-1 overflow-y-auto no-scrollbar flex-1">
          {projects.slice(0, 8).map((p) => (
            <NavLink
              key={p.id}
              to={`/app/projects/${p.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all group",
                  isActive ? "bg-secondary/60 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                )
              }
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="truncate">{p.name}</span>
            </NavLink>
          ))}
        </div>

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
              <DropdownMenuItem><Settings className="h-4 w-4 mr-2" />Settings</DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 glass border-b border-border/60">
          <div className="flex items-center gap-3 px-4 md:px-8 h-16">
            <div className="md:hidden"><Logo showText={false} /></div>
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, tasks..."
                className="pl-9 bg-secondary/40 border-border/60 focus-visible:ring-primary/40"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => navigate("/app/projects?new=1")}
                className="hidden sm:inline-flex bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
              >
                <Plus className="h-4 w-4 mr-1" /> New Project
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative h-10 w-10 rounded-xl hover:bg-secondary/60 inline-flex items-center justify-center transition-colors">
                    <Bell className="h-4 w-4" />
                    {unread > 0 && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="px-4 py-3 border-b border-border/60 font-semibold text-sm flex items-center justify-between">
                    Notifications
                    <span className="text-xs text-muted-foreground font-normal">{notifications.length} total</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 && (
                      <div className="p-6 text-sm text-muted-foreground text-center">You're all caught up 🎉</div>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 hover:bg-secondary/40 border-b border-border/40 last:border-0 cursor-pointer"
                        onClick={() => n.projectId && navigate(`/app/projects/${n.projectId}`)}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", n.type === "overdue" ? "bg-destructive" : "bg-primary")} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">{n.message}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 md:px-8 py-6 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
