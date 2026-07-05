import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { organizationsApi } from "@/api/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { TOGGLEABLE_MODULES, type ToggleableModule } from "@/types";

const MODULE_LABELS: Record<ToggleableModule, string> = {
  projects: "Projects",
  employees: "Employees",
  departments: "Departments",
  payroll: "Payroll",
  finance: "Finance",
  subscriptions: "Subscriptions",
  domains: "Domains",
  servers: "Servers",
  clients: "Clients",
  vendors: "Vendors",
  assets: "Assets",
};

export default function OrgSettings() {
  const qc = useQueryClient();
  const { data: org, isLoading } = useQuery({ queryKey: ["org-settings"], queryFn: () => organizationsApi.getMe() });

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [primaryColor, setPrimaryColor] = useState("#8A181C");
  const [enabledModules, setEnabledModules] = useState<ToggleableModule[]>([...TOGGLEABLE_MODULES]);
  const [ipEntries, setIpEntries] = useState<string[]>([]);
  const [newIpEntry, setNewIpEntry] = useState("");

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setTimezone(org.timezone ?? "UTC");
    setCurrency(org.currency ?? "USD");
    setPrimaryColor(org.branding?.primaryColor ?? "#8A181C");
    setEnabledModules(org.enabledModules ?? [...TOGGLEABLE_MODULES]);
    setIpEntries(org.ipAllowlist ?? []);
  }, [org]);

  const saveMutation = useMutation({
    mutationFn: () => organizationsApi.updateMe({ name, timezone, currency, primaryColor, enabledModules }),
    onSuccess: (updated) => {
      qc.setQueryData(["org-settings"], updated);
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not save settings")),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => organizationsApi.uploadLogo(file),
    onSuccess: (updated) => {
      qc.setQueryData(["org-settings"], updated);
      toast.success("Logo updated");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not upload logo")),
  });

  const ipMutation = useMutation({
    mutationFn: (entries: string[]) => organizationsApi.updateIpAllowlist(entries),
    onSuccess: (list) => {
      setIpEntries(list);
      toast.success("IP allowlist updated");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update IP allowlist")),
  });

  const toggleModule = (m: ToggleableModule) => {
    setEnabledModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground mt-1">Branding, modules, and workspace-wide security controls.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="glass rounded-3xl p-6 space-y-5 max-w-xl">
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 rounded-2xl bg-secondary/60 grid place-items-center overflow-hidden shrink-0"
                style={{ backgroundImage: org?.branding?.logoUrl ? `url(${org.branding.logoUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
              >
                {!org?.branding?.logoUrl && <span className="text-2xl font-bold text-muted-foreground">{name.charAt(0)}</span>}
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && logoMutation.mutate(e.target.files[0])}
                />
                <span className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-border/60 px-3 py-2 hover:bg-secondary/60 transition-colors">
                  {logoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload logo
                </span>
              </label>
            </div>

            <div>
              <Label htmlFor="org-name">Workspace name</Label>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="org-timezone">Timezone</Label>
                <Input id="org-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="org-currency">Currency</Label>
                <Input id="org-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="org-color">Brand color</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  id="org-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded-lg border border-border/60 bg-transparent cursor-pointer"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="max-w-[140px]" />
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-gradient-primary text-primary-foreground">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          <div className="glass rounded-3xl p-6 max-w-xl">
            <p className="text-sm text-muted-foreground mb-4">
              Turn off modules your workspace doesn't use. Hidden modules disappear from the sidebar for everyone, regardless of role.
            </p>
            <div className="space-y-1">
              {TOGGLEABLE_MODULES.map((m) => (
                <label key={m} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-secondary/40 cursor-pointer">
                  <span className="text-sm">{MODULE_LABELS[m]}</span>
                  <Switch checked={enabledModules.includes(m)} onCheckedChange={() => toggleModule(m)} />
                </label>
              ))}
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="mt-4 bg-gradient-primary text-primary-foreground">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <div className="glass rounded-3xl p-6 max-w-xl">
            <div className="font-semibold mb-1">IP allowlist</div>
            <p className="text-sm text-muted-foreground mb-4">
              Restrict sign-in to specific IPs or CIDR ranges (e.g. an office network or VPN). Leave empty to allow any network.
            </p>
            <div className="space-y-2 mb-4">
              {ipEntries.map((entry) => (
                <div key={entry} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <span className="text-sm font-mono flex-1">{entry}</span>
                  <button
                    onClick={() => ipMutation.mutate(ipEntries.filter((e) => e !== entry))}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {ipEntries.length === 0 && <div className="text-sm text-muted-foreground">No restrictions — any network can sign in.</div>}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newIpEntry}
                onChange={(e) => setNewIpEntry(e.target.value)}
                placeholder="203.0.113.0/24 or 203.0.113.5"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                disabled={!newIpEntry.trim() || ipMutation.isPending}
                onClick={() => {
                  ipMutation.mutate([...ipEntries, newIpEntry.trim()]);
                  setNewIpEntry("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
