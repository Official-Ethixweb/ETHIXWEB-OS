import type { AssetRecord, AttendanceRecord, Client, DepartmentRecord, Domain, Employee, Invite, LeaveRequest, Member, Organization, Payslip, ServerAsset, Subscription, Team, Transaction, Project, Task, User, Vendor } from "@/types";

const COLORS = ["#6366F1", "#A855F7", "#22D3EE", "#F472B6", "#34D399", "#FB923C"];

export function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

interface RawOrganization {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
}

export function normOrganization(raw: RawOrganization | string | null | undefined): Organization | undefined {
  if (!raw || typeof raw === "string") return undefined;
  const id = String(raw._id ?? raw.id ?? "");
  if (!id) return undefined;
  return { id, name: raw.name ?? "", slug: raw.slug ?? "" };
}

interface RawUser {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  avatarColor?: string;
  companyRole?: User["companyRole"];
  organization?: RawOrganization | string;
}

export function normUser(raw: RawUser | string | null | undefined): User | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { id: raw, name: "Unknown", email: "", avatarColor: colorFor(raw) };
  }
  const id = String(raw._id ?? raw.id ?? "");
  if (!id) return null;
  return {
    id,
    name: raw.name ?? "Unknown",
    email: raw.email ?? "",
    avatarColor: raw.avatarColor ?? colorFor(id),
    companyRole: raw.companyRole,
    organization: normOrganization(raw.organization),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normInvite(raw: any): Invite {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    email: raw.email,
    companyRole: raw.companyRole ?? "employee",
    token: raw.token,
    status: raw.status ?? "pending",
    expiresAt: raw.expiresAt,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    inviteUrl: raw.inviteUrl ?? "",
  };
}

interface RawMember {
  user: RawUser | string;
  role: "admin" | "member";
}

interface RawProject {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  color?: string;
  createdAt?: string;
  owner?: RawUser | string;
  members?: RawMember[];
}

export function normProject(raw: RawProject): Project {
  const id = String(raw._id ?? raw.id ?? "");
  const ownerUser = normUser(raw.owner);
  const members: Member[] = (raw.members ?? []).map((m) => {
    const u = normUser(m.user);
    return {
      userId: u?.id ?? (typeof m.user === "string" ? m.user : ""),
      user: u ?? undefined,
      role: m.role,
    };
  });
  // Ensure owner is also surfaced as an admin member if not already present
  if (ownerUser && !members.some((m) => m.userId === ownerUser.id)) {
    members.unshift({ userId: ownerUser.id, user: ownerUser, role: "admin" });
  }
  return {
    id,
    name: raw.name,
    description: raw.description ?? "",
    color: raw.color || colorFor(id),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    ownerId: ownerUser?.id,
    owner: ownerUser ?? undefined,
    members,
  };
}

interface RawTask {
  _id?: string;
  id?: string;
  project: string;
  title: string;
  description?: string;
  assignee?: RawUser | string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string | null;
  createdAt?: string;
  order?: number;
}

export function normTask(raw: RawTask): Task {
  const assignee = normUser(raw.assignee ?? null);
  return {
    id: String(raw._id ?? raw.id ?? ""),
    projectId: String(raw.project),
    title: raw.title,
    description: raw.description ?? "",
    assigneeId: assignee?.id ?? null,
    assignee,
    status: raw.status,
    priority: raw.priority,
    dueDate: raw.dueDate ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    order: raw.order ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normEmployee(raw: any): Employee {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    userId: raw.user ? String(raw.user) : null,
    employeeId: raw.employeeId,
    name: raw.name,
    email: raw.email,
    phone: raw.phone ?? "",
    photoUrl: raw.photoUrl ?? "",
    department: raw.department,
    designation: raw.designation,
    employmentType: raw.employmentType ?? "full_time",
    companyRole: raw.companyRole ?? "employee",
    joiningDate: raw.joiningDate,
    dateOfBirth: raw.dateOfBirth ?? null,
    status: raw.status ?? "active",
    salary: raw.salary ?? { amount: 0, currency: "INR" },
    salaryHistory: raw.salaryHistory ?? [],
    bankDetails: raw.bankDetails ?? { accountNumber: "", ifsc: "", upi: "" },
    documents: raw.documents ?? [],
    emergencyContact: raw.emergencyContact ?? { name: "", phone: "", relation: "" },
    skills: raw.skills ?? [],
    assignedAssets: raw.assignedAssets ?? [],
    notes: raw.notes ?? "",
    experienceYears: raw.experienceYears ?? 0,
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normAttendance(raw: any): AttendanceRecord {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    employeeId: String(raw.employee),
    date: raw.date,
    status: raw.status,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normLeave(raw: any): LeaveRequest {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    employeeId: String(raw.employee),
    type: raw.type,
    startDate: raw.startDate,
    endDate: raw.endDate,
    reason: raw.reason ?? "",
    status: raw.status,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normPayslip(raw: any): Payslip {
  const emp = raw.employee;
  const isPopulated = emp && typeof emp === "object";
  return {
    id: String(raw._id ?? raw.id ?? ""),
    employeeId: String(isPopulated ? emp._id ?? emp.id : emp),
    employee: isPopulated
      ? { id: String(emp._id ?? emp.id), name: emp.name, employeeId: emp.employeeId, department: emp.department, designation: emp.designation }
      : undefined,
    month: raw.month,
    baseSalary: raw.baseSalary,
    currency: raw.currency ?? "INR",
    bonuses: raw.bonuses ?? [],
    deductions: raw.deductions ?? [],
    grossPay: raw.grossPay ?? 0,
    netPay: raw.netPay ?? 0,
    paymentStatus: raw.paymentStatus,
    paidAt: raw.paidAt ?? null,
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normSubscription(raw: any): Subscription {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    vendor: raw.vendor,
    plan: raw.plan ?? "",
    cost: raw.cost ?? { amount: 0, currency: "USD" },
    billingCycle: raw.billingCycle ?? "monthly",
    renewalDate: raw.renewalDate,
    autoRenew: raw.autoRenew ?? true,
    cardUsed: raw.cardUsed ?? "",
    owner: normUser(raw.owner),
    status: raw.status ?? "active",
    invoiceUrl: raw.invoiceUrl ?? "",
    notes: raw.notes ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normDomain(raw: any): Domain {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    domainName: raw.domainName,
    registrar: raw.registrar,
    dns: raw.dns ?? "",
    sslExpiry: raw.sslExpiry ?? null,
    autoRenew: raw.autoRenew ?? true,
    cost: raw.cost ?? { amount: 0, currency: "USD" },
    renewalDate: raw.renewalDate,
    owner: normUser(raw.owner),
    status: raw.status ?? "active",
    notes: raw.notes ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normServer(raw: any): ServerAsset {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    label: raw.label,
    provider: raw.provider,
    hostingType: raw.hostingType ?? "",
    storage: raw.storage ?? { used: 0, total: 0, unit: "GB" },
    bandwidth: raw.bandwidth ?? { used: 0, total: 0, unit: "GB" },
    cost: raw.cost ?? { amount: 0, currency: "USD" },
    renewalDate: raw.renewalDate,
    status: raw.status ?? "online",
    lastCheckedAt: raw.lastCheckedAt ?? new Date().toISOString(),
    notes: raw.notes ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normEmployeeRef(raw: any): Pick<Employee, "id" | "name" | "employeeId" | "photoUrl"> | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: raw.name ?? "",
    employeeId: raw.employeeId ?? "",
    photoUrl: raw.photoUrl ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normAsset(raw: any): AssetRecord {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    label: raw.label,
    category: raw.category ?? "Other",
    serialNumber: raw.serialNumber ?? "",
    vendor: raw.vendor ?? "",
    purchaseDate: raw.purchaseDate ?? null,
    warrantyExpiry: raw.warrantyExpiry ?? null,
    cost: raw.cost ?? { amount: 0, currency: "USD" },
    assignedTo: normEmployeeRef(raw.assignedTo),
    status: raw.status ?? "available",
    notes: raw.notes ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normClient(raw: any): Client {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: raw.name,
    company: raw.company ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    address: raw.address ?? "",
    status: raw.status ?? "active",
    contractValue: raw.contractValue ?? { amount: 0, currency: "USD" },
    accountManager: normUser(raw.accountManager),
    notes: raw.notes ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normVendor(raw: any): Vendor {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: raw.name,
    category: raw.category ?? "",
    contactName: raw.contactName ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    address: raw.address ?? "",
    status: raw.status ?? "active",
    contractValue: raw.contractValue ?? { amount: 0, currency: "USD" },
    notes: raw.notes ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normDepartment(raw: any): DepartmentRecord {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: raw.name,
    description: raw.description ?? "",
    manager: normEmployeeRef(raw.manager),
    color: raw.color || colorFor(String(raw._id ?? raw.id ?? raw.name)),
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normTeam(raw: any): Team {
  const dept = raw.department;
  const isDeptPopulated = dept && typeof dept === "object";
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: raw.name,
    department: isDeptPopulated
      ? { id: String(dept._id ?? dept.id), name: dept.name, color: dept.color ?? colorFor(dept.name) }
      : null,
    lead: normEmployeeRef(raw.lead),
    members: Array.isArray(raw.members)
      ? raw.members.map(normEmployeeRef).filter((m): m is NonNullable<typeof m> => m !== null)
      : [],
    description: raw.description ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normTransaction(raw: any): Transaction {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    type: raw.type,
    amount: raw.amount,
    currency: raw.currency ?? "USD",
    category: raw.category,
    description: raw.description,
    date: raw.date,
    recurring: raw.recurring ?? false,
    attachmentUrl: raw.attachmentUrl ?? "",
    archived: raw.archived ?? false,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}
