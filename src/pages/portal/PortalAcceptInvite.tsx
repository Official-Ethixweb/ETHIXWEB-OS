import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { z } from "zod";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalApi } from "@/api/portal";
import { apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

export default function PortalAcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const type = searchParams.get("type") === "client" ? "client" : "vendor";
  const token = searchParams.get("token") || "";

  const [preview, setPreview] = useState<{ name: string; email: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setPreviewError("This invite link is missing a token.");
      return;
    }
    portalApi
      .previewInvite(type, token)
      .then((p) => {
        setPreview(p);
        setForm((f) => ({ ...f, name: p.name }));
      })
      .catch(() => setPreviewError("This invite link is invalid or has expired."));
  }, [type, token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = formSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await portalApi.acceptInvite({ type, token, name: form.name, password: form.password });
      const loginResult = await login(preview!.email, form.password);
      if (!loginResult.mfaRequired) {
        toast.success(`Welcome, ${loginResult.user.name}!`);
        navigate("/portal");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create your portal account"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="absolute top-6 left-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </div>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size={48} />
        </div>
        <div className="gradient-border rounded-3xl p-1 shadow-elevated">
          <div className="rounded-[1.4rem] glass-strong p-8">
            <h1 className="text-2xl font-bold tracking-tight text-center">
              {type === "vendor" ? "Vendor Portal Invite" : "Client Portal Invite"}
            </h1>
            {previewError ? (
              <p className="text-sm text-destructive mt-4 text-center">{previewError}</p>
            ) : !preview ? (
              <div className="grid place-items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Set a password to activate your portal account for <span className="text-foreground font-medium">{preview.email}</span>.
                </p>
                <form onSubmit={onSubmit} className="space-y-5 mt-8">
                  <div>
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-1.5 bg-secondary/40 border-border/60 h-12"
                    />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="password">Set a password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="mt-1.5 bg-secondary/40 border-border/60 h-12"
                      autoComplete="new-password"
                    />
                    {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</span>
                    ) : (
                      <span className="inline-flex items-center gap-2"><Check className="h-4 w-4" /> Activate account</span>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
