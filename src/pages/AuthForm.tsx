import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { z } from "zod";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/store";
import { toast } from "sonner";

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

export function AuthForm({ mode }: AuthFormProps) {
  const navigate = useNavigate();
  const login = useStore((s) => s.login);
  const signup = useStore((s) => s.signup);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const schema = isSignup ? signupSchema : loginSchema;
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    setTimeout(() => {
      const user = isSignup ? signup(form.name, form.email, form.password) : login(form.email, form.password);
      toast.success(isSignup ? `Welcome, ${user.name}!` : `Welcome back, ${user.name}!`);
      navigate("/app");
    }, 350);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

      <Link to="/" className="absolute top-6 left-6"><Logo /></Link>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="gradient-border rounded-3xl p-1">
          <div className="rounded-[1.4rem] glass-strong p-8">
            <h1 className="text-2xl font-bold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignup ? "Start organizing your team in 60 seconds." : "Sign in to continue to TeamFlow."}
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {isSignup && (
                <div>
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Alex Rivera"
                    className="mt-1.5 bg-secondary/40 border-border/60 h-11"
                  />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>
              )}
              <div>
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  className="mt-1.5 bg-secondary/40 border-border/60 h-11"
                />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="mt-1.5 bg-secondary/40 border-border/60 h-11"
                />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
              >
                {loading ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 text-sm text-center text-muted-foreground">
              {isSignup ? (
                <>Already have an account? <Link to="/login" className="text-primary-glow hover:underline">Sign in</Link></>
              ) : (
                <>New to TeamFlow? <Link to="/signup" className="text-primary-glow hover:underline">Create an account</Link></>
              )}
            </div>
          </div>
        </div>
        <p className="text-[0.7rem] text-center text-muted-foreground mt-4">
          Demo mode: any valid email + 6-char password works.
        </p>
      </motion.div>
    </div>
  );
}
