import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, Laptop, Loader2, LogOut, ShieldCheck, ShieldOff, ShieldPlus, XCircle } from "lucide-react";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5">
      <span className="text-xs font-mono truncate flex-1">{value}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Could not copy to clipboard");
          }
        }}
        className="h-7 w-7 shrink-0 grid place-items-center rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function Security() {
  const { user: me, logoutAll } = useAuth();
  const qc = useQueryClient();

  const [enableOpen, setEnableOpen] = useState(false);
  const [setupData, setSetupData] = useState<{ otpauth: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: () => authApi.getSessions(),
  });

  const setupMutation = useMutation({
    mutationFn: () => authApi.setupTwoFactor(),
    onSuccess: (d) => setSetupData(d),
    onError: (e) => toast.error(apiErrorMessage(e, "Could not start 2FA setup")),
  });

  const verifyMutation = useMutation({
    mutationFn: () => authApi.verifyTwoFactorSetup(code.trim()),
    onSuccess: (d) => {
      setBackupCodes(d.backupCodes);
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Two-factor authentication enabled");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Invalid code")),
  });

  const disableMutation = useMutation({
    mutationFn: () => authApi.disableTwoFactor(disablePassword),
    onSuccess: () => {
      setDisableOpen(false);
      setDisablePassword("");
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Two-factor authentication disabled");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not disable two-factor authentication")),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-sessions"] });
      setRevokingId(null);
      toast.success("Session revoked");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not revoke session")),
  });

  const onEnableOpenChange = (open: boolean) => {
    setEnableOpen(open);
    if (open && !setupData) setupMutation.mutate();
    if (!open) {
      setSetupData(null);
      setCode("");
      setBackupCodes(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground mt-1">Two-factor authentication, active sessions, and recent sign-in activity.</p>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary/20 grid place-items-center shrink-0">
              {me?.twoFactorEnabled ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldPlus className="h-5 w-5 text-primary-glow" />}
            </div>
            <div>
              <div className="font-semibold flex items-center gap-2">
                Two-factor authentication
                <Badge variant="outline" className={me?.twoFactorEnabled ? "bg-success/15 text-success border-success/30" : "bg-secondary/60"}>
                  {me?.twoFactorEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Require a code from an authenticator app (Google Authenticator, 1Password, Authy) at sign-in, in addition to your password.
              </p>
            </div>
          </div>
          {me?.twoFactorEnabled ? (
            <Button variant="outline" className="text-destructive" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="h-4 w-4 mr-1.5" /> Disable
            </Button>
          ) : (
            <Button className="bg-gradient-primary text-primary-foreground" onClick={() => onEnableOpenChange(true)}>
              <ShieldPlus className="h-4 w-4 mr-1.5" /> Enable
            </Button>
          )}
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div className="font-semibold">Active sessions</div>
          {(data?.devices?.length ?? 0) > 0 && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirmLogoutAll(true)}>
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> Log out of all devices
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (data?.devices?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">No other active sessions.</div>
        ) : (
          <div className="space-y-2">
            {data!.devices.map((d) => (
              <motion.div key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
                <Laptop className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{d.userAgent || "Unknown device"}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.ip || "Unknown IP"} &middot; {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setRevokingId(d.id)}>
                  Revoke
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="font-semibold mb-4">Recent sign-in activity</div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (data?.history?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">No recent activity.</div>
        ) : (
          <div className="space-y-2">
            {data!.history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
                {h.success ? <Check className="h-4 w-4 text-success shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{h.success ? "Successful sign-in" : "Failed sign-in attempt"}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.ip || "Unknown IP"} &middot; {formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enable 2FA dialog */}
      <Dialog open={enableOpen} onOpenChange={onEnableOpenChange}>
        <DialogContent className="glass-strong border-border/60 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldPlus className="h-4 w-4 text-accent" /> Enable two-factor authentication</DialogTitle>
            <DialogDescription>
              {backupCodes ? "Store these backup codes somewhere safe — each can be used once if you lose access to your authenticator." : "Scan this into your authenticator app, or enter the key manually, then confirm with a code."}
            </DialogDescription>
          </DialogHeader>
          {backupCodes ? (
            <>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((c) => (
                  <div key={c} className="rounded-lg bg-secondary/40 px-3 py-2 text-center">{c}</div>
                ))}
              </div>
              <Button onClick={() => onEnableOpenChange(false)} className="w-full bg-gradient-primary text-primary-foreground">
                Done
              </Button>
            </>
          ) : setupMutation.isPending || !setupData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Manual entry key</Label>
                <div className="mt-1.5"><CopyField value={setupData.secret} /></div>
              </div>
              <div>
                <Label>Setup URI</Label>
                <div className="mt-1.5"><CopyField value={setupData.otpauth} /></div>
              </div>
              <div>
                <Label htmlFor="verify-code">Enter the 6-digit code to confirm</Label>
                <Input
                  id="verify-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className="mt-1.5 bg-secondary/40 border-border/60 text-center tracking-[0.3em]"
                  maxLength={10}
                />
              </div>
              <Button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || code.trim().length < 6}
                className="w-full bg-gradient-primary text-primary-foreground"
              >
                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Confirm and enable
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA dialog */}
      <Dialog open={disableOpen} onOpenChange={(v) => { setDisableOpen(v); if (!v) setDisablePassword(""); }}>
        <DialogContent className="glass-strong border-border/60 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><ShieldOff className="h-4 w-4" /> Disable two-factor authentication</DialogTitle>
            <DialogDescription>Confirm your password to disable two-factor authentication for your account.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="disable-password">Password</Label>
            <Input
              id="disable-password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="mt-1.5"
              onKeyDown={(e) => e.key === "Enter" && disableMutation.mutate()}
            />
          </div>
          <Button
            variant="destructive"
            onClick={() => disableMutation.mutate()}
            disabled={disableMutation.isPending || !disablePassword}
            className="w-full"
          >
            {disableMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Disable
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokingId}
        onOpenChange={(v) => !v && setRevokingId(null)}
        title="Revoke this session?"
        description="That device will be signed out immediately."
        isPending={revokeMutation.isPending}
        onConfirm={() => revokingId && revokeMutation.mutate(revokingId)}
      />

      <ConfirmDialog
        open={confirmLogoutAll}
        onOpenChange={setConfirmLogoutAll}
        title="Log out of all devices?"
        description="Every active session, including this one, will be signed out."
        onConfirm={async () => {
          await logoutAll();
          setConfirmLogoutAll(false);
        }}
      />
    </div>
  );
}
