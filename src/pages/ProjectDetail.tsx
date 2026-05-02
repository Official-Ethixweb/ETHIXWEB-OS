import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Loader2, MoreHorizontal, Plus, Trash2, UserPlus } from "lucide-react";
import { format, isAfter } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { projectsApi } from "@/api/projects";
import { tasksApi, type CreateTaskInput, type UpdateTaskInput } from "@/api/tasks";
import { apiErrorMessage } from "@/lib/api";
import type { Priority, Project, Role, Status, Task } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AvatarStack, UserAvatar } from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLUMNS: { id: Status; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

interface MemberOption {
  id: string;
  name: string;
}

export default function ProjectDetail() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => tasksApi.listByProject(projectId),
    enabled: !!projectId,
  });

  const project = projectQuery.data?.project;
  const role: Role | null = projectQuery.data?.role ?? null;
  const tasks = tasksQuery.data ?? [];

  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskColumn, setTaskColumn] = useState<Status>("todo");
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // --- mutations ---
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) => tasksApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks", projectId] });
      const prev = qc.getQueryData<Task[]>(["tasks", projectId]);
      qc.setQueryData<Task[]>(["tasks", projectId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, ...patch } as Task : t))
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", projectId], ctx.prev);
      toast.error(apiErrorMessage(err, "Could not update task"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: (task) => {
      qc.setQueryData<Task[]>(["tasks", projectId], (old) => [...(old ?? []), task]);
      toast.success("Task created");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not create task")),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tasks", projectId] });
      const prev = qc.getQueryData<Task[]>(["tasks", projectId]);
      qc.setQueryData<Task[]>(["tasks", projectId], (old) => (old ?? []).filter((t) => t.id !== id));
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", projectId], ctx.prev);
      toast.error(apiErrorMessage(err, "Could not delete task"));
    },
    onSuccess: () => toast.success("Task deleted"),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.remove(projectId),
    onSuccess: () => {
      qc.setQueryData<Project[]>(["projects"], (old) => (old ?? []).filter((p) => p.id !== projectId));
      qc.removeQueries({ queryKey: ["project", projectId] });
      qc.removeQueries({ queryKey: ["tasks", projectId] });
      toast.success("Project deleted");
      navigate("/app/projects");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not delete project")),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: Role }) => projectsApi.addMember(projectId, email, role),
    onSuccess: (project) => {
      qc.setQueryData(["project", projectId], { project, role: projectQuery.data?.role ?? "admin" });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Member added");
      setMemberEmail("");
      setMemberOpen(false);
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not add member")),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(projectId, userId),
    onSuccess: (project) => {
      qc.setQueryData(["project", projectId], { project, role: projectQuery.data?.role ?? "admin" });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Member removed");
    },
    onError: (e) => toast.error(apiErrorMessage(e, "Could not remove member")),
  });

  const tasksByStatus = useMemo(() => {
    const grouped: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
    [...tasks]
      .sort((a, b) => a.order - b.order)
      .forEach((t) => grouped[t.status]?.push(t));
    return grouped;
  }, [tasks]);

  if (projectQuery.isLoading) {
    return (
      <div className="grid place-items-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <div className="text-2xl font-bold">Project not found</div>
        <Link to="/app/projects" className="text-primary-glow hover:underline mt-2 inline-block">Back to projects</Link>
      </div>
    );
  }

  const isAdmin = role === "admin";
  const isMember = role === "member" || role === "admin";

  const findContainer = (id: string): Status | null => {
    if (COLUMNS.find((c) => c.id === id)) return id as Status;
    const task = tasks.find((t) => t.id === id);
    return task?.status ?? null;
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  // Optimistically move across columns immediately
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    qc.setQueryData<Task[]>(["tasks", projectId], (old) => {
      if (!old) return old;
      return old.map((t) =>
        t.id === active.id ? { ...t, status: overContainer, order: tasksByStatus[overContainer].length } : t
      );
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer) return;

    // Reorder within column
    if (activeContainer === overContainer && active.id !== over.id) {
      const items = tasksByStatus[overContainer];
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(items, oldIndex, newIndex);
        qc.setQueryData<Task[]>(["tasks", projectId], (old) => {
          if (!old) return old;
          const others = old.filter((t) => t.status !== overContainer);
          return [...others, ...reordered.map((t, idx) => ({ ...t, order: idx }))];
        });
      }
    }

    // Persist status change to backend if column changed
    const finalTask = qc.getQueryData<Task[]>(["tasks", projectId])?.find((t) => t.id === task.id);
    if (finalTask && finalTask.status !== task.status) {
      updateTaskMutation.mutate({ id: task.id, patch: { status: finalTask.status } });
    }
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleAddMember = () => {
    if (!memberEmail.trim()) return toast.error("Email required");
    addMemberMutation.mutate({ email: memberEmail.trim(), role: memberRole });
  };

  const onDeleteProject = () => {
    if (!confirm("Delete this project and all its tasks?")) return;
    deleteProjectMutation.mutate();
  };

  const memberOptions: MemberOption[] = project.members
    .map((m) => (m.user ? { id: m.user.id, name: m.user.name } : null))
    .filter(Boolean) as MemberOption[];

  return (
    <div className="space-y-6">
      <Link to="/app/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to projects
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="h-14 w-14 rounded-2xl grid place-items-center text-white font-bold text-xl shrink-0"
            style={{ background: `linear-gradient(135deg, ${project.color}, ${project.color}99)` }}
          >
            {project.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{project.name}</h1>
              {role && (
                <span className="text-[0.62rem] uppercase tracking-widest px-2 py-1 rounded-full bg-gradient-primary/20 text-primary-glow">
                  You: {role}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 max-w-2xl">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AvatarStack users={project.members.map((m) => m.user).filter(Boolean) as NonNullable<typeof project.members[number]["user"]>[]} />
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setMemberOpen(true)} className="border-border/60">
              <UserPlus className="h-4 w-4 mr-1" /> Invite
            </Button>
          )}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDeleteProject} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Members */}
      {project.members.length > 0 && (
        <div className="glass rounded-2xl p-4 flex flex-wrap gap-2">
          {project.members.map((m) => {
            const u = m.user;
            if (!u) return null;
            return (
              <div key={m.userId} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-secondary/60">
                <UserAvatar user={u} size={24} />
                <span className="text-sm">{u.name}</span>
                <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{m.role}</span>
                {isAdmin && m.userId !== me?.id && (
                  <button
                    onClick={() => removeMemberMutation.mutate(m.userId)}
                    className="text-muted-foreground hover:text-destructive ml-1"
                    aria-label={`Remove ${u.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban */}
      {tasksQuery.isLoading ? (
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map((c) => (
            <div key={c.id} className="glass rounded-2xl p-3 min-h-[28rem] animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          <div className="grid md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                id={col.id}
                label={col.label}
                tasks={tasksByStatus[col.id]}
                canAdd={isMember}
                onAdd={() => {
                  if (!isMember) return toast.error("You don't have access to add tasks");
                  setTaskColumn(col.id);
                  setTaskOpen(true);
                }}
                onUpdateTask={(id, patch) => updateTaskMutation.mutate({ id, patch })}
                onDeleteTask={(id) => deleteTaskMutation.mutate(id)}
                isAdmin={isAdmin}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* New Task Dialog */}
      <NewTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaultStatus={taskColumn}
        canAssign={isAdmin}
        submitting={createTaskMutation.isPending}
        onCreate={(data) => {
          createTaskMutation.mutate({ ...data, projectId });
          setTaskOpen(false);
        }}
        memberOptions={memberOptions}
      />

      {/* Member Dialog */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="glass-strong border-border/60 max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="memail">Email</Label>
              <Input
                id="memail"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="mt-1.5 bg-secondary/40 border-border/60"
              />
              <p className="text-xs text-muted-foreground mt-1.5">User must already have a TeamFlow account.</p>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={memberRole} onValueChange={(v) => setMemberRole(v as "admin" | "member")}>
                <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member — can update tasks</SelectItem>
                  <SelectItem value="admin">Admin — full project control</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddMember}
              disabled={addMemberMutation.isPending}
              className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
            >
              {addMemberMutation.isPending ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Adding…</span>
              ) : "Add member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------- Column -------- */

function Column({
  id, label, tasks, canAdd, onAdd, onUpdateTask, onDeleteTask, isAdmin,
}: {
  id: Status;
  label: string;
  tasks: Task[];
  canAdd: boolean;
  onAdd: () => void;
  onUpdateTask: (id: string, patch: UpdateTaskInput) => void;
  onDeleteTask: (id: string) => void;
  isAdmin: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass rounded-2xl p-3 min-h-[28rem] transition-colors",
        isOver && "ring-2 ring-primary/40 bg-primary/[0.04]"
      )}
    >
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "h-2 w-2 rounded-full",
            id === "todo" && "bg-muted-foreground",
            id === "in_progress" && "bg-primary",
            id === "done" && "bg-success"
          )} />
          <div className="text-sm font-semibold uppercase tracking-wider">{label}</div>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
        {canAdd && (
          <button onClick={onAdd} className="h-7 w-7 rounded-lg hover:bg-secondary/60 grid place-items-center text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[6rem]">
          {tasks.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
              Drop tasks here
            </div>
          )}
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              onUpdate={(patch) => onUpdateTask(t.id, patch)}
              onDelete={() => onDeleteTask(t.id)}
              canDelete={isAdmin}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

/* -------- Task Card -------- */

function SortableTaskCard({
  task, onUpdate, onDelete, canDelete,
}: {
  task: Task;
  onUpdate: (patch: UpdateTaskInput) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onUpdate={onUpdate} onDelete={onDelete} canDelete={canDelete} />
    </div>
  );
}

function TaskCard({
  task, dragging, onUpdate, onDelete, canDelete,
}: {
  task: Task;
  dragging?: boolean;
  onUpdate?: (patch: UpdateTaskInput) => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const isOverdue = task.dueDate && task.status !== "done" && isAfter(new Date(), new Date(task.dueDate));

  return (
    <motion.div
      layout
      initial={!dragging && { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group rounded-xl bg-card p-3 border border-border/60 hover:border-primary/40 cursor-grab active:cursor-grabbing transition-all",
        dragging && "shadow-elevated rotate-2 ring-1 ring-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-snug">{task.title}</div>
        {onUpdate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 grid place-items-center rounded hover:bg-secondary/60">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onPointerDown={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onUpdate({ status: "todo" })}>Move to To Do</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdate({ status: "in_progress" })}>Move to In Progress</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdate({ status: "done" })}>Move to Done</DropdownMenuItem>
              {canDelete && onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {task.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</div>}
      <div className="flex items-center justify-between mt-3 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("text-[0.62rem] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold", PRIORITY_STYLES[task.priority])}>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className={cn("text-[0.65rem] inline-flex items-center gap-1 px-1.5 py-0.5 rounded", isOverdue ? "text-destructive" : "text-muted-foreground")}>
              <CalendarDays className="h-3 w-3" /> {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
        </div>
        {task.assignee && <UserAvatar user={task.assignee} size={22} />}
      </div>
    </motion.div>
  );
}

/* -------- New Task Dialog -------- */

function NewTaskDialog({
  open, onOpenChange, defaultStatus, onCreate, memberOptions, canAssign, submitting,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  defaultStatus: Status;
  onCreate: (data: Omit<CreateTaskInput, "projectId">) => void;
  memberOptions: MemberOption[];
  canAssign: boolean;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: defaultStatus,
    priority: "medium" as Priority,
    assigneeId: "",
    dueDate: "",
  });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, status: defaultStatus }));
  }, [open, defaultStatus]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (form.title.length > 160) return toast.error("Title too long");
    onCreate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
    });
    setForm({ title: "", description: "", status: defaultStatus, priority: "medium", assigneeId: "", dueDate: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/60 max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="ttitle">Title</Label>
            <Input
              id="ttitle"
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="What needs doing?"
              className="mt-1.5 bg-secondary/40 border-border/60"
            />
          </div>
          <div>
            <Label htmlFor="tdesc">Description</Label>
            <Textarea
              id="tdesc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Add context for your team..."
              className="mt-1.5 bg-secondary/40 border-border/60 min-h-[80px]"
              maxLength={1000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Status }))}>
                <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}>
                <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assignee {!canAssign && <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">(admin only)</span>}</Label>
              <Select
                value={form.assigneeId || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v === "none" ? "" : v }))}
                disabled={!canAssign}
              >
                <SelectTrigger className="mt-1.5 bg-secondary/40 border-border/60"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {memberOptions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tdue">Due date</Label>
              <Input
                id="tdue"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="mt-1.5 bg-secondary/40 border-border/60"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Creating…</span>
            ) : "Create task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
