import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { z } from "zod";
import { invitesApi } from "@/api/invites";
import { authApi } from "@/api/auth";
import { Logo } from "@/components/Logo";
import { LogoReveal } from "@/components/LogoReveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { getPasswordStrength } from "@/lib/password";
import { Eye, EyeOff, Loader2, Check, Shield, Sparkles, ArrowLeft, ShieldCheck } from "lucide-react";
import { CursorSpotlight } from "@/components/CursorSpotlight";
import { FloatingParticles } from "@/components/FloatingParticles";
import { MiniProductPreview } from "@/components/MiniProductPreview";
import { useCountUp } from "@/hooks/useCountUp";

interface AuthFormProps {
  mode: "login" | "signup";
}

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});
const signupSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Name is too short").max(80),
});
const workspaceNameSchema = z.string().trim().min(2, "Workspace name is too short").max(120);

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const showcaseStats = [
  { value: 10, suffix: "x", label: "Faster planning" },
  { value: 98, suffix: "%", label: "On-time delivery" },
  { value: 24, suffix: "h", label: "Avg. setup time" },
];

function ShowcaseStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const animated = useCountUp(value, 1.2);
  return (
    <div>
      <div className="text-3xl font-bold gradient-text">
        {animated}
        {suffix}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, verifyTwoFactorLogin, signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [organizationName, setOrganizationName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const isSignup = mode === "signup";
  const inviteToken = isSignup ? searchParams.get("invite") : null;
  const [invitePreview, setInvitePreview] = useState<{ organizationName: string; email: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const strength = getPasswordStrength(form.password);

  useEffect(() => {
    if (!inviteToken) {
      setInvitePreview(null);
      setInviteError(null);
      return;
    }
    invitesApi
      .preview(inviteToken)
      .then((p) => {
        setInvitePreview(p);
        setForm((f) => ({ ...f, email: p.email }));
      })
      .catch(() => setInviteError("This invite link is invalid or has expired."));
  }, [inviteToken]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = isSignup ? signupSchema : loginSchema;
    const result = schema.safeParse(form);
    const errs: Record<string, string> = {};
    if (!result.success) {
      result.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
    }
    if (isSignup && !inviteToken) {
      const orgResult = workspaceNameSchema.safeParse(organizationName);
      if (!orgResult.success) errs.organizationName = orgResult.error.issues[0].message;
    }
    if (isSignup && inviteToken && !invitePreview) {
      errs.email = inviteError || "Waiting on invite details, try again in a moment.";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      if (isSignup) {
        const user = await signup(
          form.name,
          form.email,
          form.password,
          inviteToken ? { mode: "join_invite", inviteToken } : { mode: "create_org", organizationName }
        );
        toast.success(`Welcome, ${user.name}!`);
        navigate("/app");
        return;
      }
      const result = await login(form.email, form.password);
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        return;
      }
      toast.success(`Welcome back, ${result.user.name}!`);
      navigate(result.user.userType && result.user.userType !== "staff" ? "/portal" : "/app");
    } catch (err) {
      toast.error(apiErrorMessage(err, isSignup ? "Could not create account" : "Could not sign in"));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken || mfaCode.trim().length < 6) return;
    setLoading(true);
    try {
      const user = await verifyTwoFactorLogin(mfaToken, mfaCode.trim());
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.userType && user.userType !== "staff" ? "/portal" : "/app");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Invalid code"));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const onForgotOpenChange = (open: boolean) => {
    setForgotOpen(open);
    if (!open) {
      setForgotEmail("");
      setForgotSent(false);
    }
  };

  const onForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      toast.error("Enter a valid email");
      return;
    }
    setForgotLoading(true);
    try {
      await authApi.forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send reset link"));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex">
      {/* Left showcase pane */}
      <div className="hidden lg:flex lg:w-[54%] relative overflow-hidden bg-background border-r border-border/60">
        <div className="absolute inset-0" style={{ backgroundImage: "var(--gradient-mesh)" }} />
        <CursorSpotlight size={700} />
        <FloatingParticles count={26} />
        <motion.div
          animate={reduceMotion ? undefined : { x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl"
        />
        <motion.div
          animate={reduceMotion ? undefined : { x: [0, -24, 0], y: [0, 24, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="pointer-events-none absolute bottom-0 -right-24 h-[24rem] w-[24rem] rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative z-10 flex flex-col justify-center px-16 py-16 max-w-2xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Logo size={44} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1] mt-10"
          >
            Run the whole company <span className="gradient-text">from one screen.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-4 text-lg text-muted-foreground max-w-lg"
          >
            Projects, people, and progress in a single premium workspace built for ETHIXWEB.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-3 gap-6 mt-10 max-w-sm"
          >
            {showcaseStats.map((s) => (
              <ShowcaseStat key={s.label} {...s} />
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12"
          >
            <MiniProductPreview />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 glass rounded-2xl p-5"
          >
            <ul className="space-y-2.5">
              {["Real-time Kanban with drag-and-drop", "Employee directory, attendance & leave", "Command palette & keyboard-first workflow"].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0">
                    <Check className="h-3 w-3" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>

      {/* Right auth pane */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-12 lg:px-16 overflow-hidden">
        <div className="lg:hidden absolute inset-0">
          <CursorSpotlight size={500} />
          <FloatingParticles count={16} />
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="absolute top-6 left-6 z-10 flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="lg:hidden">
            <Link to="/"><Logo /></Link>
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, x: shake ? [0, -10, 10, -8, 8, -4, 4, 0] : 0 }}
          transition={{ duration: shake ? 0.5 : 0.4 }}
          className="relative w-full max-w-md"
        >
          <div className="flex justify-center mb-8 lg:hidden">
            <LogoReveal size={64} />
          </div>
          <div className="gradient-border rounded-3xl p-1 shadow-elevated hover:shadow-glow transition-shadow duration-500">
            <div className="rounded-[1.4rem] glass-strong p-8 md:p-12">
              {mfaToken ? (
                <>
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 text-primary grid place-items-center">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-center mt-4">Two-factor code</h1>
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Enter the 6-digit code from your authenticator app, or one of your backup codes.
                  </p>
                  <form onSubmit={onMfaSubmit} className="space-y-5 mt-8">
                    <div>
                      <Label htmlFor="mfa-code">Verification code</Label>
                      <Input
                        id="mfa-code"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="000000"
                        className="mt-1.5 bg-secondary/40 border-border/60 h-12 text-base text-center tracking-[0.3em]"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={10}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading || mfaCode.trim().length < 6}
                      className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                        </span>
                      ) : (
                        "Verify"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setMfaToken(null);
                        setMfaCode("");
                      }}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Back to sign in
                    </button>
                  </form>
                </>
              ) : (
                <>
              <h1 className="text-3xl font-bold tracking-tight text-center">{isSignup ? "Create your account" : "Welcome back"}</h1>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {isSignup ? "Set up your ETHIXWEB OS workspace in 60 seconds." : "Sign in to continue to ETHIXWEB OS."}
              </p>

              {/* Social login placeholders */}
              <div className="grid grid-cols-2 gap-3 mt-8">
                {["Google", "Microsoft"].map((provider) => (
                  <Tooltip key={provider}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled
                        className="h-11 rounded-xl border border-border/60 bg-secondary/30 text-sm font-medium text-muted-foreground cursor-not-allowed inline-flex items-center justify-center gap-2 opacity-60"
                      >
                        Continue with {provider}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Coming soon</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or continue with email</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <motion.form
                onSubmit={onSubmit}
                className="space-y-5"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
              >
                {isSignup && (
                  <motion.div variants={fieldVariants}>
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Alex Rivera"
                      className="mt-1.5 bg-secondary/40 border-border/60 h-12 text-base"
                      autoComplete="name"
                    />
                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                  </motion.div>
                )}
                {isSignup && inviteToken && (
                  <motion.div variants={fieldVariants} className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm">
                    {invitePreview ? (
                      <span>
                        You're joining <span className="font-semibold text-foreground">{invitePreview.organizationName}</span> as{" "}
                        <span className="text-muted-foreground">{invitePreview.email}</span>.
                      </span>
                    ) : inviteError ? (
                      <span className="text-destructive">{inviteError}</span>
                    ) : (
                      <span className="text-muted-foreground">Loading invite details…</span>
                    )}
                  </motion.div>
                )}
                {isSignup && !inviteToken && (
                  <motion.div variants={fieldVariants}>
                    <Label htmlFor="organizationName">Workspace name</Label>
                    <Input
                      id="organizationName"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Acme Inc."
                      className="mt-1.5 bg-secondary/40 border-border/60 h-12 text-base"
                      autoComplete="organization"
                    />
                    {errors.organizationName && <p className="text-xs text-destructive mt-1">{errors.organizationName}</p>}
                  </motion.div>
                )}
                <motion.div variants={fieldVariants}>
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="you@ethixweb.com"
                      className="bg-secondary/40 border-border/60 h-12 text-base pr-9"
                      autoComplete="email"
                      readOnly={isSignup && !!inviteToken && !!invitePreview}
                    />
                    <AnimatePresence>
                      {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
                        >
                          <Check className="h-4 w-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </motion.div>
                <motion.div variants={fieldVariants}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignup && (
                      <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-primary-glow hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="bg-secondary/40 border-border/60 h-12 text-base pr-10"
                      autoComplete={isSignup ? "new-password" : "current-password"}
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
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}

                  {isSignup && form.password && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2.5">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className="h-1 flex-1 rounded-full bg-secondary overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${strength.colorClass}`}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: i < strength.score ? 1 : 0 }}
                              style={{ transformOrigin: "left" }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                        <Shield className="h-3 w-3" /> {strength.label}
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                <motion.div variants={fieldVariants} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
                      </span>
                    ) : isSignup ? "Create account" : "Sign in"}
                  </Button>
                </motion.div>
              </motion.form>

              <div className="mt-7 text-sm text-center text-muted-foreground">
                {isSignup ? (
                  <>Already have an account? <Link to="/login" className="text-primary-glow hover:underline">Sign in</Link></>
                ) : (
                  <>New to ETHIXWEB OS? <Link to="/signup" className="text-primary-glow hover:underline">Create an account</Link></>
                )}
              </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={onForgotOpenChange}>
        <DialogContent className="glass-strong border-border/60 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Reset your password</DialogTitle>
            <DialogDescription>
              {forgotSent
                ? "If an account exists for that email, we've sent a reset link. It expires in 15 minutes."
                : "Enter your work email and we'll send you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>
          {forgotSent ? (
            <Button onClick={() => onForgotOpenChange(false)} className="w-full bg-gradient-primary text-primary-foreground">
              Got it
            </Button>
          ) : (
            <form onSubmit={onForgotSubmit} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email">Work email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@ethixweb.com"
                  className="mt-1.5 bg-secondary/40 border-border/60 h-11"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={forgotLoading} className="w-full bg-gradient-primary text-primary-foreground">
                {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Send reset link
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
