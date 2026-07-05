import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, ShieldCheck, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { portalAdminApi } from "@/api/portal";
import type { Client, Vendor } from "@/types";

interface PortalAccessDialogProps {
  type: "vendor" | "client";
  record: Vendor | Client | null;
  onOpenChange: (open: boolean) => void;
  invalidateKey: string;
}

export function PortalAccessDialog({ type, record, onOpenChange, invalidateKey }: PortalAccessDialogProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const { data: defs } = useQuery({
    queryKey: ["portal-admin", "permissions"],
    queryFn: portalAdminApi.permissionDefs,
    enabled: !!record,
  });

  useEffect(() => {
    setSelected(record?.portalPermissions ?? []);
    setInviteUrl(null);
  }, [record]);

  const inviteMutation = useMutation({
    mutationFn: () => portalAdminApi.invite(type, record!.id),
    onSuccess: (url) => setInviteUrl(url),
    onError: (e) => toast.error(apiErrorMessage(e, "Could not create invite")),
  });

  const permissionsMutation = useMutation({
    mutationFn: (perms: string[]) => portalAdminApi.setPermissions(type, record!.id, perms),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
      toast.success("Portal permissions updated");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update permissions")),
  });

  const toggleMutation = useMutation({
    mutationFn: () => portalAdminApi.toggle(type, record!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [invalidateKey] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not update portal access")),
  });

  if (!record) return null;
  const permissionDefs = type === "vendor" ? defs?.vendor : defs?.client;

  const copyInvite = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  };

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/60 max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" /> Portal access — {record.name}
          </DialogTitle>
          <DialogDescription>
            Control exactly what this {type} can see in their self-service portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {record.portalHasAccount ? (
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Portal access</div>
                <div className="text-xs text-muted-foreground">
                  {record.portalEnabled ? "Enabled — this contact can sign in" : "Disabled — sign-in is blocked"}
                </div>
              </div>
              <Switch
                checked={record.portalEnabled}
                disabled={toggleMutation.isPending}
                onCheckedChange={() => toggleMutation.mutate()}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {!record.email ? (
                <p className="text-sm text-destructive">Add an email address to this {type} before inviting them.</p>
              ) : inviteUrl ? (
                <div className="space-y-2">
                  <Label>Invite link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteUrl} className="bg-secondary/40 border-border/60 text-xs" />
                    <Button type="button" size="icon" variant="outline" onClick={copyInvite}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Share this link with {record.name}. It expires in 7 days.</p>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending}
                  className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
                >
                  {inviteMutation.isPending ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Creating invite&hellip;</span>
                  ) : (
                    "Generate portal invite"
                  )}
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>What can they see?</Label>
            <div className="space-y-2 rounded-xl border border-border/60 p-3">
              {!permissionDefs ? (
                <div className="py-4 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                permissionDefs.map((p) => (
                  <label key={p.key} className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={selected.includes(p.key)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => (checked ? [...prev, p.key] : prev.filter((k) => k !== p.key)))
                      }
                    />
                    {p.label}
                  </label>
                ))
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={permissionsMutation.isPending}
              onClick={() => permissionsMutation.mutate(selected)}
            >
              {permissionsMutation.isPending ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving&hellip;</span>
              ) : (
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4" /> Save permissions</span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
