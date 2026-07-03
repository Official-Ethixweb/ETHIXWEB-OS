import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/api/auth";
import { apiErrorMessage } from "@/lib/api";
import { getPasswordStrength } from "@/lib/password";

const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(100);

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const strength = getPasswordStrength(password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword(token || "", password);
      setDone(true);
      toast.success("Password reset successfully");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-12">
      <div className="absolute top-6 left-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size={64} />
        </div>
        <div className="gradient-border rounded-3xl p-1 shadow-elevated">
          <div className="rounded-[1.4rem] glass-strong p-8 md:p-12">
            {!token ? (
              <div className="text-center space-y-3">
                <h1 className="text-2xl font-bold">Invalid reset link</h1>
                <p className="text-sm text-muted-foreground">
                  This password reset link is missing a token. Request a new one from the sign-in page.
                </p>
                <Button onClick={() => navigate("/login")} className="w-full bg-gradient-primary text-primary-foreground mt-4">
                  Back to sign in
                </Button>
              </div>
            ) : done ? (
              <div className="text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-success/15 text-success grid place-items-center">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold">Password reset</h1>
                <p className="text-sm text-muted-foreground">Your password has been updated. You can now sign in.</p>
                <Button onClick={() => navigate("/login")} className="w-full bg-gradient-primary text-primary-foreground mt-4">
                  Sign in
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight text-center">Set a new password</h1>
                <p className="text-sm text-muted-foreground mt-2 text-center">Choose a new password for your account.</p>

                <form onSubmit={onSubmit} className="space-y-5 mt-8">
                  <div>
                    <Label htmlFor="password">New password</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-secondary/40 border-border/60 h-12 text-base pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password && (
                      <div className="mt-2.5">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-1 flex-1 rounded-full bg-secondary overflow-hidden">
                              <div className={`h-full rounded-full ${i < strength.score ? strength.colorClass : ""}`} />
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5">{strength.label}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1.5 bg-secondary/40 border-border/60 h-12 text-base"
                      autoComplete="new-password"
                    />
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
                      </span>
                    ) : (
                      "Reset password"
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
