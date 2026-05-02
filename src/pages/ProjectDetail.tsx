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
import { ArrowLeft, CalendarDays, MoreHorizontal, Plus, Trash2, UserPlus } from "lucide-react";
import { format, isAfter } from "date-fns";
import { useCurrentUser, useStore } from "@/store";
import type { Priority, Status, Task } from "@/types";
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

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const me = useCurrentUser();

  const project = useStore((s) => s.projects.find((p) => p.id === projectId));
  const allTasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const role = useStore((s) => (projectId ? s.getRole(projectId) : null));
  const moveTask = useStore((s) => s.moveTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const createTask = useStore((s) => s.createTask);
  const deleteProject = useStore((s) => s.deleteProject);
  const addMember = useStore((s) => s.addMember);
  const removeMember = useStore((s) => s.removeMember);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskColumn, setTaskColumn] = useState<Status>("todo");
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "member">("member");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tasksByStatus = useMemo(() => {
    const grouped: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
    allTasks
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => a.order - b.order)
      .forEach((t) => grouped[t.status].push(t));
    return grouped;
  }, [allTasks, projectId]);

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
    const task = allTasks.find((t) => t.id === id);
    return task?.status ?? null;
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    const task = allTasks.find((t) => t.id === active.id);
    if (!task) return;
    moveTask(task.id, overContainer, tasksByStatus[overContainer].length);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer && active.id !== over.id) {
      const items = tasksByStatus[overContainer];
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(items, oldIndex, newIndex);
        reordered.forEach((t, idx) => updateTask(t.id, { order: idx }));
      }
    }
  };

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) : null;

  const handleAddMember = () => {
    const user = users.find((u) => u.email.toLowerCase() === memberEmail.toLowerCase().trim());
    if (!user) return toast.error("No user found with that email. Try alex@teamflow.app, sam@teamflow.app, priya@teamflow.app, jordan@teamflow.app");
    if (project.members.find((m) => m.userId === user.id)) return toast.error("Already a member");
    addMember(project.id, user.id, memberRole);
    toast.success(`${user.name} added as ${memberRole}`);
    setMemberEmail("");
    setMemberOpen(false);
  };

  const onDeleteProject = () => {
    if (!confirm("Delete this project and all its tasks?")) return;
    deleteProject(project.id);
    toast.success("Project deleted");
    navigate("/app/projects");
  };

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
          <AvatarStack users={project.members.map((m) => users.find((u) => u.id === m.userId)!)} />
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
            const u = users.find((u) => u.id === m.userId);
            if (!u) return null;
            return (
              <div key={m.userId} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-secondary/60">
                <UserAvatar user={u} size={24} />
                <span className="text-sm">{u.name}</span>
                <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{m.role}</span>
                {isAdmin && m.userId !== me?.id && (
                  <button onClick={() => removeMember(project.id, m.userId)} className="text-muted-foreground hover:text-destructive ml-1">
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              label={col.label}
              tasks={tasksByStatus[col.id]}
              onAdd={() => {
                if (!isMember) return toast.error("You don't have access to add tasks");
                setTaskColumn(col.id);
                setTaskOpen(true);
              }}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* New Task Dialog */}
      <NewTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        defaultStatus={taskColumn}
        onCreate={(data) => {
          createTask({ ...data, projectId: project.id });
          toast.success("Task created");
        }}
        memberOptions={project.members.map((m) => users.find((u) => u.id === m.userId)!).filter(Boolean)}
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
            <Button onClick={handleAddMember} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">Add member</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------- Column -------- */

function Column({ id, label, tasks, onAdd }: { id: Status; label: string; tasks: Task[]; onAdd: () => void }) {
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
        <button onClick={onAdd} className="h-7 w-7 rounded-lg hover:bg-secondary/60 grid place-items-center text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[6rem]">
          {tasks.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
              Drop tasks here
            </div>
          )}
          {tasks.map((t) => <SortableTaskCard key={t.id} task={t} />)}
        </div>
      </SortableContext>
    </div>
  );
}

/* -------- Task Card -------- */

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task, dragging }: { task: Task; dragging?: boolean }) {
  const users = useStore((s) => s.users);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const assignee = users.find((u) => u.id === task.assigneeId);
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild onPointerDown={(e) => e.stopPropagation()}>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 grid place-items-center rounded hover:bg-secondary/60">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onPointerDown={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => updateTask(task.id, { status: "todo" })}>Move to To Do</DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateTask(task.id, { status: "in_progress" })}>Move to In Progress</DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateTask(task.id, { status: "done" })}>Move to Done</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        {assignee && <UserAvatar user={assignee} size={22} />}
      </div>
    </motion.div>
  );
}

/* -------- New Task Dialog -------- */

function NewTaskDialog({
  open,
  onOpenChange,
  defaultStatus,
  onCreate,
  memberOptions,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  defaultStatus: Status;
  onCreate: (data: Omit<Task, "id" | "createdAt" | "order" | "projectId">) => void;
  memberOptions: { id: string; name: string }[];
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: defaultStatus,
    priority: "medium" as Priority,
    assigneeId: "",
    dueDate: "",
  });

  // sync default column when opened from a different column
  useEffect(() => {
    if (open) setForm((f) => ({ ...f, status: defaultStatus }));
  }, [open, defaultStatus]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (form.title.length > 120) return toast.error("Title too long");
    onCreate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId || undefined,
      dueDate: form.dueDate || undefined,
    });
    setForm({ title: "", description: "", status: defaultStatus, priority: "medium", assigneeId: "", dueDate: "" });
    onOpenChange(false);
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
              <Label>Assignee</Label>
              <Select value={form.assigneeId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v === "none" ? "" : v }))}>
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
          <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground">Create task</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
