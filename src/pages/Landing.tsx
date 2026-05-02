import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, CheckCircle2, KanbanSquare, Sparkles, Users2, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const features = [
  { icon: KanbanSquare, title: "Kanban that flows", desc: "Drag, drop, done. A board your team will actually use every day." },
  { icon: Users2, title: "Per-project roles", desc: "Admins shape the work. Members focus on shipping. Permissions, sorted." },
  { icon: BarChart3, title: "Real progress", desc: "Live dashboards make stand-ups boring — in the best possible way." },
  { icon: Zap, title: "Fast by default", desc: "Optimistic UI, keyboard-first, instant search. Built for momentum." },
];

const stats = [
  { value: "10×", label: "Faster planning cycles" },
  { value: "98%", label: "On-time delivery" },
  { value: "24h", label: "Avg. setup time" },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-96 w-[60rem] rounded-full bg-primary-glow/20 blur-3xl" />

      {/* Nav */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-5">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#showcase" className="hover:text-foreground transition-colors">Showcase</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/signup">
              <Button size="sm" className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground mb-8"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          New · Realtime kanban with per-project roles
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-[1.05]"
        >
          The team task manager <br className="hidden md:block" />
          <span className="gradient-text">teams actually love.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance"
        >
          Organize. Assign. Deliver. TeamFlow blends the speed of Linear with the clarity of a kanban — without the bloat.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link to="/signup">
            <Button size="lg" className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-elevated h-12 px-7 text-base">
              Start for free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="h-12 px-7 text-base border-border/80 bg-secondary/40 backdrop-blur">
              Sign in
            </Button>
          </Link>
        </motion.div>
        <div className="mt-6 text-xs text-muted-foreground inline-flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> No credit card · 2-minute setup
        </div>

        {/* Hero card preview */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-16 md:mt-24 mx-auto max-w-5xl"
        >
          <div className="absolute inset-0 -m-6 bg-gradient-primary opacity-30 blur-3xl rounded-[2rem]" />
          <div className="relative gradient-border rounded-3xl p-2 shadow-elevated">
            <div className="rounded-[1.4rem] glass-strong overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                </div>
                <div className="text-xs text-muted-foreground ml-3">teamflow.app / projects / Q4 Launch</div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-5 text-left">
                {["To Do", "In Progress", "Done"].map((col, ci) => (
                  <div key={col} className="rounded-2xl bg-secondary/40 p-3 min-h-[280px]">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 px-1">{col}</div>
                    <div className="space-y-2">
                      {[0, 1, 2].slice(0, 3 - ci).map((i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + ci * 0.15 + i * 0.07 }}
                          className="rounded-xl bg-card p-3 border border-border/60 hover:border-primary/40 transition-colors"
                        >
                          <div className="text-sm font-medium mb-2">
                            {["Draft launch post", "Record teaser video", "Update pricing hero", "Press list outreach", "Launch checklist"][ci * 2 + i] ?? "Refine copy"}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-[0.65rem] px-2 py-0.5 rounded-full ${["bg-destructive/15 text-destructive", "bg-warning/15 text-warning", "bg-success/15 text-success"][i % 3]}`}>
                              {["High", "Medium", "Low"][i % 3]}
                            </span>
                            <div className="h-6 w-6 rounded-full bg-gradient-primary" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl md:text-4xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="text-sm uppercase tracking-widest text-accent mb-3">Built for shipping</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Everything you need.<br/><span className="text-muted-foreground">Nothing you don't.</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.07 }}
              className="group relative glass rounded-2xl p-6 hover:border-primary/40 hover:-translate-y-1 transition-all"
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-primary/20 grid place-items-center mb-4 group-hover:bg-gradient-primary/30 transition-colors">
                <f.icon className="h-5 w-5 text-primary-glow" />
              </div>
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-sm text-muted-foreground leading-relaxed">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl gradient-border p-10 md:p-14 text-center">
          <div className="absolute inset-0 bg-gradient-primary opacity-10" />
          <div className="relative">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight">Ship work, not status updates.</h3>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Spin up TeamFlow in two minutes. Your team will thank you on Friday.</p>
            <Link to="/signup">
              <Button size="lg" className="mt-7 bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-elevated h-12 px-8">
                Get started free <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Logo size={26} />
          <div>© {new Date().getFullYear()} TeamFlow. Crafted with care.</div>
        </div>
      </footer>
    </div>
  );
}
