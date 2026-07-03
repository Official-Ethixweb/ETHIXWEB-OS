import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";

export function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user: me, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isOwner = me?.companyRole === "owner";

  const handleClose = (next: boolean) => {
    if (!next) setPassword("");
    onOpenChange(next);
  };

  const handleDelete = async () => {
    if (!password) return;
    setLoading(true);
    try {
      await deleteAccount(password);
      toast.success("Your account has been deleted");
      navigate("/");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete account"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-strong border-border/60 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Delete account
          </DialogTitle>
          <DialogDescription>
            {isOwner
              ? "You're the workspace owner. This permanently deletes your account and, if you're the only member, your entire workspace and all its data. This cannot be undone."
              : "This permanently deletes your account. This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="delete-password">Confirm your password</Label>
          <Input
            id="delete-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1.5"
            autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && handleDelete()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading || !password}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
