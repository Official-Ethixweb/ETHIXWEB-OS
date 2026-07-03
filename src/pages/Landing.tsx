import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  CreditCard,
  Globe2,
  KanbanSquare,
  Server,
  Sparkles,
  UserPlus,
  Users2,
  Wallet,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/TiltCard";
import { CursorSpotlight } from "@/components/CursorSpotlight";
import { FloatingParticles } from "@/components/FloatingParticles";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const features = [
  { icon: KanbanSquare, title: "Kanban that flows", desc: "Drag, drop, done. A board your team will actually use every day." },
  { icon: Users2, title: "Employee directory", desc: "Profiles, attendance, and leave for every person at ETHIXWEB, all in one source of truth." },
  { icon: BarChart3, title: "Real progress", desc: "Live dashboards make stand-ups boring, in the best possible way." },
  { icon: Zap, title: "Fast by default", desc: "Optimistic UI, keyboard-first, command palette. Built for momentum." },
];

const stats = [
  { value: "10×", label: "Faster planning cycles" },
  { value: "98%", label: "On-time delivery" },
  { value: "24h", label: "Avg. setup time" },
];

const pricingFeatures = [
  "Unlimited projects & tasks",
  "Kanban board with drag-and-drop",
  "Employee directory & attendance",
  "Command palette & keyboard shortcuts",
  "Real-time dashboards & analytics",
  "Priority email support",
];

const BASE_PRICE = 5;

const billingPlans = [
  { id: "monthly", label: "Monthly", months: 1, discount: 0, note: "Billed monthly. Cancel anytime.", badge: null, highlight: false },
  { id: "sixMonth", label: "6 Months", months: 6, discount: 0.05, note: "Billed every 6 months.", badge: "Most popular", highlight: true },
  { id: "yearly", label: "1 Year", months: 12, discount: 0.1, note: "Billed annually.", badge: "Best value", highlight: false },
] as const;

function planPricing(plan: (typeof billingPlans)[number]) {
  const monthly = Math.round(BASE_PRICE * (1 - plan.discount) * 100) / 100;
  const total = Math.round(monthly * plan.months * 100) / 100;
  return { monthly, total, savingsPct: Math.round(plan.discount * 100) };
}

function money(n: number) {
  return n.toFixed(2).replace(/\.00$/, "");
}

const modules = [
  { icon: Users2, title: "Employee / HRMS", desc: "Directory, attendance, leave, and profiles for the whole company.", live: true },
  { icon: Wallet, title: "Payroll", desc: "Salary runs, payslips, and deductions handled automatically.", live: true },
  { icon: CreditCard, title: "Subscriptions", desc: "Track every SaaS tool the company pays for in one place.", live: true },
  { icon: Globe2, title: "Domain Manager", desc: "Renewal dates, DNS, and SSL expiry, tracked and alerted.", live: true },
  { icon: Server, title: "Server Manager", desc: "Reported status, renewals, and hosting costs across every provider.", live: true },
  { icon: BarChart3, title: "Finance", desc: "Expense tracking and cash-flow reporting, company-wide.", live: true },
];

const timelineSteps = [
  { icon: UserPlus, title: "Create your workspace", desc: "Sign up in under a minute, no credit card required." },
  { icon: Users2, title: "Invite your team", desc: "Add teammates and set roles: admin, manager, or member." },
  { icon: KanbanSquare, title: "Organize the work", desc: "Spin up projects, build boards, assign the first tasks." },
  { icon: Zap, title: "Ship, faster", desc: "Live dashboards keep everyone aligned without the status meetings." },
];

const faqs = [
  { q: "Is there a free trial?", a: "Yes. Every plan starts with full access and no credit card required. You only add billing details when you're ready to keep going past the trial." },
  { q: "Can I switch billing cycles later?", a: "Anytime. Move between monthly, 6-month, and annual billing from your account settings, and the new discount applies from your next cycle." },
  { q: "Who owns our data?", a: "You do, fully. Your workspace data is never used to train models or shared with third parties, and you can export everything at any time." },
  { q: "How long does onboarding take?", a: "Most teams are fully set up, with projects created and teammates invited, in under 24 hours." },
  { q: "What happens if I cancel?", a: "Your workspace stays read-only for 30 days so you can export anything you need, then it's permanently deleted." },
];

export default function Landing() {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const orbY1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const orbY2 = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const orbY3 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative orbs: parallax + continuous drift */}
      <motion.div
        style={{ y: orbY1 }}
        animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, -16, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
      />
      <motion.div
        style={{ y: orbY2 }}
        animate={reduceMotion ? undefined : { x: [0, -20, 0], y: [0, 20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="pointer-events-none absolute top-40 -right-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
      />
      <motion.div
        style={{ y: orbY3 }}
        animate={reduceMotion ? undefined : { scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-96 w-[60rem] rounded-full bg-primary-glow/20 blur-3xl"
      />

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
            <ThemeToggle />
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
      <motion.section ref={heroRef} style={{ opacity: heroFade }} className="relative z-10 max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-24 text-center">
        <CursorSpotlight size={600} />
        <FloatingParticles count={18} />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground mb-8"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          ETHIXWEB OS · Projects, tasks, and people in one place
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-[1.05]"
        >
          The operating system <br className="hidden md:block" />
          <span className="gradient-text">for how ETHIXWEB runs.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance"
        >
          Organize. Assign. Deliver. ETHIXWEB OS blends the speed of Linear with the clarity of a kanban, without the bloat.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link to="/signup">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-elevated h-12 px-7 text-base">
                Start for free <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </motion.div>
          </Link>
          <Link to="/login">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" variant="outline" className="h-12 px-7 text-base border-border/80 bg-secondary/40 backdrop-blur">
                Sign in
              </Button>
            </motion.div>
          </Link>
        </motion.div>
        <div className="mt-6 text-xs text-muted-foreground inline-flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> No credit card · 2-minute setup
        </div>

        {/* Hero card preview */}
        <motion.div
          id="showcase"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: [0, -10, 0], scale: 1 }}
          transition={{
            opacity: { duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] },
            y: { duration: 6, delay: 1.1, repeat: Infinity, ease: "easeInOut" },
          }}
          className="relative mt-16 md:mt-24 mx-auto max-w-5xl scroll-mt-24"
        >
          <div className="absolute inset-0 -m-6 bg-gradient-primary opacity-30 blur-3xl rounded-[2rem]" />
          <TiltCard strength={4} className="relative gradient-border rounded-3xl p-2 shadow-elevated">
            <div className="rounded-[1.4rem] glass-strong overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                </div>
                <div className="text-xs text-muted-foreground ml-3">ethixweb.os / projects / Q4 Launch</div>
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
          </TiltCard>
        </motion.div>
      </motion.section>

      {/* Stats */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="glass rounded-2xl p-7 text-center hover:-translate-y-1 hover:shadow-glow transition-all"
            >
              <div className="text-3xl md:text-4xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-28">
        <div className="text-center mb-16">
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
            >
              <TiltCard strength={6} className="group glass rounded-2xl p-7 hover:border-primary/40 hover:-translate-y-1 transition-all overflow-hidden border border-transparent">
                <div className="h-11 w-11 rounded-xl bg-gradient-primary/20 grid place-items-center mb-4 group-hover:bg-gradient-primary/30 transition-colors">
                  <f.icon className="h-5 w-5 text-primary-glow" />
                </div>
                <div className="font-semibold mb-1">{f.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{f.desc}</div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Module grid: what's live today vs. on the roadmap */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-28">
        <div className="text-center mb-16">
          <div className="text-sm uppercase tracking-widest text-accent mb-3">Built for the whole company</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">One workspace.<br/><span className="text-muted-foreground">Every department.</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.06 }}
            >
              <TiltCard
                strength={m.live ? 6 : 3}
                className={`group relative rounded-2xl p-7 transition-all overflow-hidden border ${
                  m.live ? "glass hover:border-primary/40 hover:-translate-y-1 border-transparent" : "border-border/40 bg-secondary/20 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-11 w-11 rounded-xl grid place-items-center transition-colors ${m.live ? "bg-gradient-primary/20 group-hover:bg-gradient-primary/30" : "bg-secondary/60"}`}>
                    <m.icon className={`h-5 w-5 ${m.live ? "text-primary-glow" : "text-muted-foreground"}`} />
                  </div>
                  {m.live ? (
                    <span className="text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full bg-success/15 text-success">Live</span>
                  ) : (
                    <span className="text-[0.65rem] uppercase tracking-wider px-2 py-1 rounded-full bg-secondary text-muted-foreground">Coming soon</span>
                  )}
                </div>
                <div className="font-semibold mb-1">{m.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{m.desc}</div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Timeline / how it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24 md:py-28">
        <div className="text-center mb-16">
          <div className="text-sm uppercase tracking-widest text-accent mb-3">How it works</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Live in minutes.<br/><span className="text-muted-foreground">Not sprints.</span></h2>
        </div>
        <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "left" }}
            className="hidden lg:block absolute top-6 left-0 right-0 h-px bg-gradient-primary opacity-40"
          />
          {timelineSteps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative text-center lg:text-left"
            >
              <div className="h-12 w-12 rounded-2xl bg-gradient-primary text-primary-foreground grid place-items-center mx-auto lg:mx-0 shadow-glow relative z-10">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="text-xs text-muted-foreground mt-4">Step {i + 1}</div>
              <div className="font-semibold text-lg mt-1">{step.title}</div>
              <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{step.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-28">
        <div className="text-center mb-16">
          <div className="text-sm uppercase tracking-widest text-accent mb-3">Simple pricing</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            One price. <span className="text-muted-foreground">Pick your cycle.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">No tiers to compare, no features locked away. Just ETHIXWEB OS, per person, and the longer you commit the more you save.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
          {billingPlans.map((plan, i) => {
            const pricing = planPricing(plan);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`relative ${plan.highlight ? "md:-mt-4 md:mb-4" : ""}`}
              >
                {plan.highlight && (
                  <div className="absolute inset-0 -m-4 bg-gradient-primary opacity-25 blur-3xl rounded-[2rem]" />
                )}
                <TiltCard
                  strength={5}
                  className={`relative rounded-3xl p-1 h-full glass-sheen ${plan.highlight ? "gradient-border shadow-elevated" : "border border-border/60 shadow-card"}`}
                >
                  <div className={`rounded-[1.4rem] p-8 text-center h-full flex flex-col ${plan.highlight ? "glass-strong" : "glass"}`}>
                    {plan.badge ? (
                      <div
                        className={`inline-flex items-center gap-1.5 self-center rounded-full px-3 py-1 text-xs font-medium mb-6 ${
                          plan.highlight
                            ? "bg-gradient-primary/15 border border-primary/30 text-primary-glow"
                            : "bg-success/15 border border-success/30 text-success"
                        }`}
                      >
                        <Sparkles className="h-3 w-3" /> {plan.badge}
                      </div>
                    ) : (
                      <div className="h-[26px] mb-6" />
                    )}

                    <div className="text-sm uppercase tracking-widest text-muted-foreground">{plan.label}</div>
                    <div className="flex items-end justify-center gap-1 mt-2">
                      <span className="text-xl font-semibold text-muted-foreground mb-1.5">$</span>
                      <span className="text-5xl font-bold tracking-tight">{money(pricing.monthly)}</span>
                      <span className="text-muted-foreground mb-1.5">/ user / mo</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {plan.months === 1 ? plan.note : `${plan.note} $${money(pricing.total)} total, save ${pricing.savingsPct}%.`}
                    </p>

                    <ul className="mt-8 space-y-3 text-left flex-1">
                      {pricingFeatures.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm">
                          <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0">
                            <Check className="h-3 w-3" />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link to="/signup" className="block mt-8">
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Button
                          size="lg"
                          className={`w-full h-12 ${
                            plan.highlight
                              ? "bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow"
                              : "bg-secondary/60 hover:bg-secondary text-foreground border border-border/60"
                          }`}
                        >
                          Start for ${money(pricing.monthly)}/mo <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </motion.div>
                    </Link>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 text-xs text-muted-foreground inline-flex items-center gap-1.5 w-full justify-center">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" /> No credit card required to start. Cancel anytime.
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-24 md:py-28">
        <div className="text-center mb-16">
          <div className="text-sm uppercase tracking-widest text-accent mb-3">Questions</div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Frequently asked.</h2>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="glass rounded-2xl px-6"
        >
          <Accordion type="single" collapsible>
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`} className="border-border/60">
                <AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl gradient-border p-10 md:p-14 text-center"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-primary"
            animate={{ opacity: [0.08, 0.16, 0.08] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight">Ship work, not status updates.</h3>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Spin up ETHIXWEB OS in two minutes. Your team will thank you on Friday.</p>
            <Link to="/signup">
              <motion.div className="inline-block" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" className="mt-7 bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-elevated h-12 px-8">
                  Get started free <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </motion.div>
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border/60">
        <div className="max-w-7xl mx-auto px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <Logo size={36} />
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">The operating system for how ETHIXWEB runs: projects, people, and progress in one workspace.</p>
            <div className="mt-5"><ThemeToggle /></div>
          </div>
          {[
            { title: "Product", links: ["Features", "Pricing", "Showcase"] },
            { title: "Company", links: ["About", "Careers", "Contact"] },
            { title: "Legal", links: ["Privacy", "Terms", "Security"] },
          ].map((col) => (
            <div key={col.title}>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-4">{col.title}</div>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border/60">
          <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-muted-foreground">
            © {new Date().getFullYear()} ETHIXWEB. Crafted with care.
          </div>
        </div>
      </footer>
    </div>
  );
}
