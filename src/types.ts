export type Role = "admin" | "member";
export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "in_progress" | "done";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface Member {
  userId: string;
  user?: User; // populated by API
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  ownerId?: string;
  owner?: User;
  members: Member[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string | null;
  assignee?: User | null;
  status: Status;
  priority: Priority;
  dueDate?: string | null;
  createdAt: string;
  order: number;
}

export interface Notification {
  id: string;
  type: "assigned" | "overdue" | "status";
  message: string;
  taskId?: string;
  projectId?: string;
  createdAt: string;
  read: boolean;
}
