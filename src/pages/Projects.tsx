import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { useAllTasks } from "@/hooks/useAllTasks";
import { useAuth } from "@/context/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AvatarStack } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import type { Project } from "@/types";

const swatches = ["#6366F1", "#A855F7", "#22D3EE", "#F472B6", "#34D399", "#FB923C", "#EF4444"];

export default function Projects() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", description: "", color: swatches[0] });

  const { data: projects = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const { tasks } = useAllTasks();

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (project) => {
      qc.setQueryData<Project[]>(["projects"], (old) => (old ? [project, ...old] : [project]));
      toast.success("Project created");
      setForm({ name: "", description: "", color: swatches[0] });
      setOpen(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not create project")),
  });

  useEffect(() => {
    if (params.get("new") === "1") {
      setOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(debouncedQuery.toLowerCase())),
    [projects, debouncedQuery]
  );

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Project name is required");
    if (form.name.length > 80) return toast.error("Name too long");
    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">All the work, organized by team.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 md:flex-initial md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              className="pl-9 bg-secondary/40 border-border/60"
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4 mr-1" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border/60 max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Create a new project</DialogTitle>
              </DialogHeader>
              <form onSubmit={onCreate} className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="pname">Project name</Label>
                  <Input
                    id="pname"
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Q4 Product Launch"
                    className="mt-1.5 bg-secondary/40 border-border/60"
                  />
                </div>
                <div>
                  <Label htmlFor="pdesc">Description</Label>
                  <Textarea
                    id="pdesc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What is this project about?"
                    className="mt-1.5 bg-secondary/40 border-border/60 min-h-[90px]"
                    maxLength={500}
                  />
                </div>
                <div>
                  <Label>Accent color</Label>
                  <div className="flex gap-2 mt-2">
                    {swatches.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`h-7 w-7 rounded-full transition-transform ${form.color === c ? "ring-2 ring-offset-2 ring-offset-background ring-white scale-110" : "hover:scale-110"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
                >
                  {createMutation.isPending ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Creating…</span>
                  ) : "Create project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 animate-pulse h-44" />
          ))}
        </div>
      ) : isError ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="font-semibold text-lg">We couldn't reach the API</div>
          <div className="text-sm text-muted-foreground mt-1">Check your backend is running and <code>VITE_API_URL</code> is correct.</div>
          <Button onClick={() => refetch()} className="mt-5">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-primary/20 grid place-items-center mb-4">
            <FolderPlus className="h-7 w-7 text-primary-glow" />
          </div>
          <div className="font-semibold text-lg">{projects.length === 0 ? "No projects yet" : "No projects match your search"}</div>
          <div className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Create your first project to start organizing tasks and inviting teammates.</div>
          <Button onClick={() => setOpen(true)} className="mt-5 bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Create project
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((p, i) => {
              const pTasks = tasks.filter((t) => t.projectId === p.id);
              const done = pTasks.filter((t) => t.status === "done").length;
              const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
              const role = p.members.find((m) => m.userId === me?.id)?.role;
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={`/app/projects/${p.id}`}
                    className="group block glass rounded-2xl p-5 hover:-translate-y-1 hover:shadow-elevated transition-all relative overflow-hidden"
                  >
                    <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: p.color }} />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="h-10 w-10 rounded-xl grid place-items-center text-white font-bold" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}99)` }}>
                          {p.name[0]}
                        </div>
                        {role && (
                          <span className="text-[0.6rem] uppercase tracking-widest px-2 py-1 rounded-full bg-secondary/60 text-muted-foreground">
                            {role}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-lg leading-tight group-hover:text-primary-glow transition-colors">{p.name}</div>
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">{p.description || "No description yet."}</div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                          <span>{done}/{pTasks.length} tasks</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.color}, hsl(var(--primary-glow)))` }} />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <AvatarStack users={p.members.map((m) => m.user).filter(Boolean) as NonNullable<typeof p.members[number]["user"]>[]} />
                        <span className="text-xs text-muted-foreground">{p.members.length} members</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
