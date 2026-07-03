import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Loader2, Mail, Plus, Trash2, UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitesApi } from "@/api/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import type { CompanyRole, Invite } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow } from "date-fns";

const ROLES: CompanyRole[] = ["hr", "finance", "manager", "developer", "designer", "qa", "employee", "viewer"];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Invite link copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy to clipboard");
        }
      }}
      className="h-8 w-8 shrink-0 grid place-items-center rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Copy invite link"
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export default function Team() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("employee");
  const [createdInvite, setCreatedInvite] = useState<{ invite: Invite; inviteUrl: string } | null>(null);
  const [revoking, setRevoking] = useState<Invite | null>(null);

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["invites"],
    queryFn: () => invitesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => invitesApi.create(email, role),
    onSuccess: (result) => {
      qc.setQueryData<Invite[]>(["invites"], (old) => (old ? [result.invite, ...old] : [result.invite]));
      setCreatedInvite(result);
      setEmail("");
      setRole("employee");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not create invite")),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => invitesApi.revoke(id),
    onSuccess: (_v, id) => {
      qc.setQueryData<Invite[]>(["invites"], (old) => old?.filter((i) => i.id !== id));
      toast.success("Invite revoked");
      setRevoking(null);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not revoke invite")),
  });

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Email is required");
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">
            Invite teammates to {me?.organization?.name ?? "your workspace"}. There's no email delivery yet, so share the generated link directly.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4 mr-1" /> Invite teammate
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong border-border/60 max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-accent" /> Invite teammate</DialogTitle>
            </DialogHeader>
            <form onSubmit={onCreate} className="space-y-4 mt-2">
              <div>
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="mt-1.5 bg-secondary/40 border-border/60"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
                  <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">
                {createMutation.isPending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Creating&hellip;</span> : "Create invite link"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl p-5 h-16 overflow-hidden"><div className="skeleton-shimmer h-full w-full rounded-xl" /></div>)}</div>
      ) : invites.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-primary/20 grid place-items-center mb-4"><Mail className="h-7 w-7 text-primary-glow" /></div>
          <div className="font-semibold text-lg">No pending invites</div>
          <div className="text-sm text-muted-foreground mt-1">Invite teammates to start building out your workspace.</div>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {invites.map((i) => (
              <motion.div key={i.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass rounded-2xl p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-primary/20 grid place-items-center shrink-0"><Mail className="h-4 w-4 text-primary-glow" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Invited as {i.companyRole} &middot; expires {formatDistanceToNow(new Date(i.expiresAt), { addSuffix: true })}
                  </div>
                </div>
                <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">pending</Badge>
                <CopyButton value={i.inviteUrl} />
                <button
                  onClick={() => setRevoking(i)}
                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  aria-label="Revoke invite"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!createdInvite} onOpenChange={(v) => { if (!v) { setCreatedInvite(null); setOpen(false); } }}>
        <DialogContent className="glass-strong border-border/60 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Invite created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share this link with {createdInvite?.invite.email}. It expires in 7 days.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5">
            <span className="text-sm truncate flex-1">{createdInvite?.inviteUrl}</span>
            {createdInvite && <CopyButton value={createdInvite.inviteUrl} />}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(v) => !v && setRevoking(null)}
        title={`Revoke invite for ${revoking?.email ?? "this teammate"}?`}
        description="The invite link will stop working immediately."
        isPending={revokeMutation.isPending}
        onConfirm={() => revoking && revokeMutation.mutate(revoking.id)}
      />
    </div>
  );
}
