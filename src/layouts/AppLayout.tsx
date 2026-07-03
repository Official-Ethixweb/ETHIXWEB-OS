import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Briefcase,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Command,
  CreditCard,
  DollarSign,
  FolderKanban,
  Globe,
  HeartPulse,
  History,
  Laptop,
  LayoutDashboard,
  LogOut,
  Menu,
  Pin,
  PinOff,
  Plus,
  Search,
  Server as ServerIcon,
  Settings,
  Store,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { format, formatDistanceToNow } from "date-fns";
import { projectsApi } from "@/api/projects";
import { employeesApi } from "@/api/employees";
import { subscriptionsApi } from "@/api/subscriptions";
import { domainsApi } from "@/api/domains";
import { serversApi } from "@/api/servers";
import { payrollApi } from "@/api/payroll";
import { useAllTasks } from "@/hooks/useAllTasks";
import { useDerivedNotifications } from "@/hooks/useDerivedNotifications";
import { useEmployeeNotifications } from "@/hooks/useEmployeeNotifications";
import { useRenewalNotifications } from "@/hooks/useRenewalNotifications";
import { usePayrollNotifications } from "@/hooks/usePayrollNotifications";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited";
import { usePinnedProjects } from "@/hooks/usePinnedProjects";
import { useLiveClock } from "@/hooks/useLiveClock";
import { ASSET_COMPANY_ROLES, FINANCE_COMPANY_ROLES, OPS_COMPANY_ROLES, OWNER_COMPANY_ROLES } from "@/types";

const baseNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/employees", label: "Employees", icon: Users },
  { to: "/app/departments", label: "Departments", icon: Building2 },
];

const financeNav = [
  { to: "/app/payroll", label: "Payroll", icon: Wallet },
  { to: "/app/finance", label: "Finance", icon: DollarSign },
];

const opsNav = [
  { to: "/app/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/app/domains", label: "Domains", icon: Globe },
  { to: "/app/servers", label: "Servers", icon: ServerIcon },
  { to: "/app/clients", label: "Clients", icon: Briefcase },
  { to: "/app/vendors", label: "Vendors", icon: Store },
];

const assetsNav = [{ to: "/app/assets", label: "Assets", icon: Laptop }];

const ownerNav = [{ to: "/app/team", label: "Team", icon: UserPlus }];

export default function AppLayout() {
  const { user: me, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ew_sidebar_collapsed") === "1");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const canFinance = !!me?.companyRole && FINANCE_COMPANY_ROLES.includes(me.companyRole);
  const canOps = !!me?.companyRole && OPS_COMPANY_ROLES.includes(me.companyRole);
  const canAssets = !!me?.companyRole && ASSET_COMPANY_ROLES.includes(me.companyRole);
  const canOwner = !!me?.companyRole && OWNER_COMPANY_ROLES.includes(me.companyRole);

  const nav = useMemo(() => {
    const items = [...baseNav];
    if (canFinance) items.push(...financeNav);
    if (canOps) items.push(...opsNav);
    if (canAssets) items.push(...assetsNav);
    if (canOwner) items.push(...ownerNav);
    return items;
  }, [canFinance, canOps, canAssets, canOwner]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("ew_sidebar_collapsed", !c ? "1" : "0");
      return !c;
    });
  };

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list(),
  });

  const { tasks } = useAllTasks();
  const taskNotifications = useDerivedNotifications(tasks, projects);
  const employeeNotifications = useEmployeeNotifications(employees);

  const { data: subscriptions = [] } = useQuery({ queryKey: ["subscriptions"], queryFn: () => subscriptionsApi.list(), enabled: canOps });
  const { data: domains = [] } = useQuery({ queryKey: ["domains"], queryFn: () => domainsApi.list(), enabled: canOps });
  const { data: servers = [] } = useQuery({ queryKey: ["servers"], queryFn: () => serversApi.list(), enabled: canOps });
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: payslips = [] } = useQuery({ queryKey: ["payroll", currentMonth], queryFn: () => payrollApi.list({ month: currentMonth }), enabled: canFinance });
  const renewalNotifications = useRenewalNotifications(subscriptions, domains, servers);
  const payrollNotifications = usePayrollNotifications(payslips);

  const notifications = [...taskNotifications, ...employeeNotifications, ...renewalNotifications, ...payrollNotifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.length;

  const { pinnedIds, isPinned, togglePin } = usePinnedProjects();
  const pinnedProjects = projects.filter((p) => pinnedIds.includes(p.id));

  const visitedProjectMatch = location.pathname.match(/^\/app\/projects\/([^/]+)/);
  const visitedEmployeeMatch = location.pathname.match(/^\/app\/employees\/([^/]+)/);
  const visitedProject = visitedProjectMatch ? projects.find((p) => p.id === visitedProjectMatch[1]) : null;
  const visitedEmployee = visitedEmployeeMatch ? employees.find((e) => e.id === visitedEmployeeMatch[1]) : null;
  const currentLabel = visitedProject?.name ?? visitedEmployee?.name ?? null;
  const recentlyVisited = useRecentlyVisited(
    location.pathname,
    currentLabel,
    visitedProject?.color
  ).filter((v) => v.path !== location.pathname);

  const clock = useLiveClock();
  const companyHealth = (() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()).length;
    const onLeave = employees.filter((e) => e.status === "on_leave").length;
    const completionScore = total > 0 ? (done / total) * 100 : 100;
    const onTimeScore = total > 0 ? ((total - overdue) / total) * 100 : 100;
    const availabilityScore = employees.length > 0 ? ((employees.length - onLeave) / employees.length) * 100 : 100;
    return Math.round(completionScore * 0.4 + onTimeScore * 0.3 + availabilityScore * 0.3);
  })();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <>
      <div className="orb-container">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      <CommandPalette />

      {/* Mobile nav drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="glass-strong border-border/60 p-0 w-[85%] flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="p-5 border-b border-border/60">
            <Logo />
          </div>
          <nav className="px-3 py-4 space-y-1">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-colors",
                    isActive ? "text-foreground bg-gradient-subtle" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )
                }
              >
                <Icon className="h-5 w-5" /> {label}
              </NavLink>
            ))}
          </nav>
          {projects.length > 0 && (
            <>
              <div className="px-5 mt-2 mb-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">Projects</div>
              <div className="px-3 space-y-1 overflow-y-auto flex-1">
                {projects.map((p) => (
                  <NavLink
                    key={p.id}
                    to={`/app/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </NavLink>
                ))}
              </div>
            </>
          )}
          <div className="p-3 border-t border-border/60 mt-auto">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-h-screen flex">
        {/* Sidebar */}
        <motion.aside
          animate={{ width: collapsed ? 76 : 256 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="hidden md:flex shrink-0 flex-col border-r border-border/60 glass-strong sticky top-0 h-screen overflow-hidden"
        >
        <div className="p-5 flex items-center justify-between">
          <NavLink to="/app" className="min-w-0">
            <Logo showText={!collapsed} />
            {!collapsed && me?.organization?.name && (
              <div className="text-xs text-muted-foreground truncate mt-1 pl-0.5">{me.organization.name}</div>
            )}
          </NavLink>
        </div>
        <nav className="px-3 space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all relative overflow-hidden group",
                  isActive
                    ? "text-foreground bg-gradient-subtle shadow-card"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-gradient-primary opacity-10 pointer-events-none"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavBar"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 bg-gradient-primary rounded-r-full shadow-glow"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <motion.span whileHover={{ scale: 1.15, rotate: -4 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="z-10 shrink-0 inline-flex">
                    <Icon className={cn("h-4 w-4", isActive && "text-primary-glow")} />
                  </motion.span>
                  {!collapsed && <span className="z-10 truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {pinnedProjects.length > 0 && (
              <>
                <div className="px-5 mt-6 mb-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </div>
                <div className="px-3 space-y-1">
                  {pinnedProjects.map((p) => (
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
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="truncate flex-1">{p.name}</span>
                    </NavLink>
                  ))}
                </div>
              </>
            )}

            {recentlyVisited.length > 0 && (
              <>
                <div className="px-5 mt-6 mb-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
                  <History className="h-2.5 w-2.5" /> Recently visited
                </div>
                <div className="px-3 space-y-1">
                  {recentlyVisited.map((v) => (
                    <NavLink
                      key={v.path}
                      to={v.path}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: v.color ?? "hsl(var(--muted-foreground))" }} />
                      <span className="truncate">{v.label}</span>
                    </NavLink>
                  ))}
                </div>
              </>
            )}

            <div className="px-5 mt-6 mb-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">Projects</div>
            <div className="px-3 space-y-1">
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
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="truncate flex-1">{p.name}</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePin(p.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary-glow shrink-0"
                    aria-label={isPinned(p.id) ? "Unpin project" : "Pin project"}
                  >
                    {isPinned(p.id) ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                </NavLink>
              ))}
            </div>
          </div>
        )}
        {collapsed && <div className="flex-1" />}

        <div className="p-3 border-t border-border/60">
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-2 py-2 hover:bg-secondary/60 transition-colors text-muted-foreground text-xs mb-1"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-secondary/60 transition-colors">
                <UserAvatar user={me} size={34} />
                {!collapsed && (
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{me?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{me?.email}</div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56">
              <DropdownMenuLabel>
                My account
                {me?.organization?.name && (
                  <div className="text-xs font-normal text-muted-foreground truncate">{me.organization.name}</div>
                )}
              </DropdownMenuLabel>
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
      </motion.aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 glass border-b border-border/60">
          <div className="flex items-center gap-3 px-4 md:px-8 h-16">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden h-9 w-9 rounded-lg hover:bg-secondary/60 inline-flex items-center justify-center transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="md:hidden"><Logo showText={false} /></div>
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden sm:flex items-center gap-2 max-w-md flex-1 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search or jump to...</span>
              <span className="inline-flex items-center gap-0.5 text-[0.65rem] px-1.5 py-0.5 rounded border border-border/60">
                <Command className="h-2.5 w-2.5" />K
              </span>
            </button>
            <div className="relative flex-1 sm:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="pl-9 bg-secondary/40 border-border/60 focus-visible:ring-primary/40"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1.5 rounded-lg bg-secondary/40 border border-border/60">
                <Clock3 className="h-3.5 w-3.5" /> {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div
                className={cn(
                  "hidden lg:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border",
                  companyHealth >= 80
                    ? "text-success border-success/30 bg-success/10"
                    : companyHealth >= 50
                      ? "text-warning border-warning/30 bg-warning/10"
                      : "text-destructive border-destructive/30 bg-destructive/10"
                )}
                title="Company health"
              >
                <HeartPulse className="h-3.5 w-3.5" /> {companyHealth}
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/app/projects?new=1")}
                className="hidden sm:inline-flex bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
              >
                <Plus className="h-4 w-4 mr-1" /> New Project
              </Button>
              <ThemeToggle />
              <Popover>
                <PopoverTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    animate={unread > 0 ? { rotate: [0, -12, 10, -6, 0] } : {}}
                    transition={unread > 0 ? { duration: 0.6, repeat: Infinity, repeatDelay: 4 } : {}}
                    className="relative h-10 w-10 rounded-xl hover:bg-secondary/60 inline-flex items-center justify-center transition-colors"
                  >
                    <Bell className="h-4 w-4" />
                    {unread > 0 && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
                    )}
                  </motion.button>
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
                        onClick={() => {
                          if (n.href) navigate(n.href);
                          else if (n.projectId) navigate(`/app/projects/${n.projectId}`);
                          else if (n.employeeId) navigate(`/app/employees/${n.employeeId}`);
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-1.5 h-2 w-2 rounded-full shrink-0",
                              n.type === "overdue" || n.type === "payroll"
                                ? "bg-destructive"
                                : n.type === "birthday" || n.type === "anniversary" || n.type === "renewal"
                                ? "bg-accent"
                                : "bg-primary"
                            )}
                          />
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
    </>
  );
}
