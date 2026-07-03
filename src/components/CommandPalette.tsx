import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, DollarSign, FolderKanban, Globe, LayoutDashboard, Plus, Server as ServerIcon, Users, Wallet } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { projectsApi } from "@/api/projects";
import { employeesApi } from "@/api/employees";
import { subscriptionsApi } from "@/api/subscriptions";
import { domainsApi } from "@/api/domains";
import { serversApi } from "@/api/servers";
import { financeApi } from "@/api/finance";
import { useAuth } from "@/context/AuthContext";
import { FINANCE_COMPANY_ROLES, OPS_COMPANY_ROLES } from "@/types";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canFinance = !!user?.companyRole && FINANCE_COMPANY_ROLES.includes(user.companyRole);
  const canOps = !!user?.companyRole && OPS_COMPANY_ROLES.includes(user.companyRole);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    enabled: open,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: employeesApi.list,
    enabled: open,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => subscriptionsApi.list(),
    enabled: open && canOps,
  });

  const { data: domains = [] } = useQuery({
    queryKey: ["domains"],
    queryFn: () => domainsApi.list(),
    enabled: open && canOps,
  });

  const { data: servers = [] } = useQuery({
    queryKey: ["servers"],
    queryFn: () => serversApi.list(),
    enabled: open && canOps,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["finance-transactions-palette"],
    queryFn: () => financeApi.list(),
    enabled: open && canFinance,
  });

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <DialogDescription className="sr-only">Search and jump to pages, projects, employees, or company records</DialogDescription>
      <CommandInput placeholder="Search or jump to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/app")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/app/projects")}>
            <FolderKanban className="mr-2 h-4 w-4" /> Projects
          </CommandItem>
          <CommandItem onSelect={() => go("/app/employees")}>
            <Users className="mr-2 h-4 w-4" /> Employees
          </CommandItem>
          {canFinance && (
            <CommandItem onSelect={() => go("/app/payroll")}>
              <Wallet className="mr-2 h-4 w-4" /> Payroll
            </CommandItem>
          )}
          {canFinance && (
            <CommandItem onSelect={() => go("/app/finance")}>
              <DollarSign className="mr-2 h-4 w-4" /> Finance
            </CommandItem>
          )}
          {canOps && (
            <CommandItem onSelect={() => go("/app/subscriptions")}>
              <CreditCard className="mr-2 h-4 w-4" /> Subscriptions
            </CommandItem>
          )}
          {canOps && (
            <CommandItem onSelect={() => go("/app/domains")}>
              <Globe className="mr-2 h-4 w-4" /> Domains
            </CommandItem>
          )}
          {canOps && (
            <CommandItem onSelect={() => go("/app/servers")}>
              <ServerIcon className="mr-2 h-4 w-4" /> Servers
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick create">
          <CommandItem onSelect={() => go("/app/projects?new=1")}>
            <Plus className="mr-2 h-4 w-4" /> New project
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/employees?new=1")}>
            <Plus className="mr-2 h-4 w-4" /> Add employee
          </CommandItem>
          {canFinance && (
            <CommandItem onSelect={() => go("/app/finance?new=1")}>
              <Plus className="mr-2 h-4 w-4" /> Add transaction
            </CommandItem>
          )}
          {canFinance && (
            <CommandItem onSelect={() => go("/app/subscriptions?new=1")}>
              <Plus className="mr-2 h-4 w-4" /> Add subscription
            </CommandItem>
          )}
          {canFinance && (
            <CommandItem onSelect={() => go("/app/domains?new=1")}>
              <Plus className="mr-2 h-4 w-4" /> Add domain
            </CommandItem>
          )}
          {canFinance && (
            <CommandItem onSelect={() => go("/app/servers?new=1")}>
              <Plus className="mr-2 h-4 w-4" /> Add server
            </CommandItem>
          )}
        </CommandGroup>
        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.slice(0, 8).map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/app/projects/${p.id}`)}>
                  <span className="mr-2 h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {employees.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Employees">
              {employees.slice(0, 8).map((e) => (
                <CommandItem key={e.id} onSelect={() => go(`/app/employees/${e.id}`)}>
                  <Users className="mr-2 h-4 w-4" /> {e.name}
                  <span className="ml-2 text-xs text-muted-foreground">{e.department}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {canOps && subscriptions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Subscriptions">
              {subscriptions.slice(0, 8).map((s) => (
                <CommandItem key={s.id} onSelect={() => go("/app/subscriptions")}>
                  <CreditCard className="mr-2 h-4 w-4" /> {s.vendor}
                  <span className="ml-2 text-xs text-muted-foreground">${s.cost.amount}/{s.billingCycle}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {canOps && domains.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Domains">
              {domains.slice(0, 8).map((d) => (
                <CommandItem key={d.id} onSelect={() => go("/app/domains")}>
                  <Globe className="mr-2 h-4 w-4" /> {d.domainName}
                  <span className="ml-2 text-xs text-muted-foreground">{d.registrar}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {canOps && servers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Servers">
              {servers.slice(0, 8).map((s) => (
                <CommandItem key={s.id} onSelect={() => go("/app/servers")}>
                  <ServerIcon className="mr-2 h-4 w-4" /> {s.label}
                  <span className="ml-2 text-xs text-muted-foreground">{s.provider}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {canFinance && transactions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Finance">
              {transactions.slice(0, 8).map((t) => (
                <CommandItem key={t.id} onSelect={() => go("/app/finance")}>
                  <DollarSign className="mr-2 h-4 w-4" /> {t.description}
                  <span className="ml-2 text-xs text-muted-foreground">{t.type === "income" ? "+" : "-"}${t.amount}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
