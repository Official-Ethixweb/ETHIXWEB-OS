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
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  members: Member[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  status: Status;
  priority: Priority;
  dueDate?: string;
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
