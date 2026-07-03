export type Role = "admin" | "member";
export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "in_progress" | "done";
export type CompanyRole =
  | "superadmin"
  | "owner"
  | "hr"
  | "finance"
  | "manager"
  | "developer"
  | "designer"
  | "qa"
  | "employee"
  | "viewer";

export const HR_COMPANY_ROLES: CompanyRole[] = ["superadmin", "owner", "hr"];
export const OWNER_COMPANY_ROLES: CompanyRole[] = ["superadmin", "owner"];

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  companyRole?: CompanyRole;
  organization?: Organization;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Invite {
  id: string;
  email: string;
  companyRole: CompanyRole;
  token: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  inviteUrl: string;
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
  type: "assigned" | "overdue" | "status" | "birthday" | "anniversary" | "renewal" | "payroll";
  message: string;
  taskId?: string;
  projectId?: string;
  employeeId?: string;
  href?: string;
  createdAt: string;
  read: boolean;
}

export type Department = "Engineering" | "Design" | "HR" | "Finance" | "Sales" | "Marketing" | "Operations" | "Support";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeStatus = "active" | "on_leave" | "resigned" | "terminated";

export interface EmployeeDocument {
  type: string;
  url: string;
  uploadedAt: string;
}

export interface SalaryHistoryEntry {
  amount: number;
  effectiveDate: string;
  reason: string;
}

export interface AssignedAsset {
  type: string;
  label: string;
  assignedDate: string;
}

export interface Employee {
  id: string;
  userId?: string | null;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  department: Department;
  designation: string;
  employmentType: EmploymentType;
  companyRole: CompanyRole;
  joiningDate: string;
  dateOfBirth: string | null;
  status: EmployeeStatus;
  salary: { amount: number; currency: string };
  salaryHistory: SalaryHistoryEntry[];
  bankDetails: { accountNumber: string; ifsc: string; upi: string };
  documents: EmployeeDocument[];
  emergencyContact: { name: string; phone: string; relation: string };
  skills: string[];
  assignedAssets: AssignedAsset[];
  notes: string;
  experienceYears: number;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export type AttendanceStatus = "present" | "absent" | "leave" | "holiday";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
}

export type LeaveType = "sick" | "casual" | "earned" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

export const FINANCE_COMPANY_ROLES: CompanyRole[] = ["superadmin", "owner", "finance"];
export const OPS_COMPANY_ROLES: CompanyRole[] = ["superadmin", "owner", "finance", "manager"];
export const ASSET_COMPANY_ROLES: CompanyRole[] = ["superadmin", "owner", "finance", "manager", "hr"];

// --- Payroll ---
export interface PayLineItem {
  label: string;
  amount: number;
}

export type PaymentStatus = "pending" | "paid";

export interface Payslip {
  id: string;
  employeeId: string;
  employee?: Pick<Employee, "id" | "name" | "employeeId" | "department" | "designation">;
  month: string; // YYYY-MM
  baseSalary: number;
  currency: string;
  bonuses: PayLineItem[];
  deductions: PayLineItem[];
  grossPay: number;
  netPay: number;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  generatedAt: string;
  archived: boolean;
  archivedAt: string | null;
}

// --- Subscriptions ---
export type BillingCycle = "monthly" | "yearly" | "weekly" | "custom";
export type SubscriptionStatus = "active" | "trial" | "cancelled";

export interface Subscription {
  id: string;
  vendor: string;
  plan: string;
  cost: { amount: number; currency: string };
  billingCycle: BillingCycle;
  renewalDate: string;
  autoRenew: boolean;
  cardUsed: string;
  owner?: User | null;
  status: SubscriptionStatus;
  invoiceUrl: string;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

// --- Domain Manager ---
export type DomainStatus = "active" | "expiring" | "expired";

export interface Domain {
  id: string;
  domainName: string;
  registrar: string;
  dns: string;
  sslExpiry: string | null;
  autoRenew: boolean;
  cost: { amount: number; currency: string };
  renewalDate: string;
  owner?: User | null;
  status: DomainStatus;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

// --- Server Manager ---
export type ServerProvider = "Railway" | "Vercel" | "Render" | "AWS" | "Azure" | "GCP" | "DigitalOcean" | "VPS" | "Other";
export type ServerStatus = "online" | "offline" | "degraded";

export interface UsageStat {
  used: number;
  total: number;
  unit: string;
}

export interface ServerAsset {
  id: string;
  label: string;
  provider: ServerProvider;
  hostingType: string;
  storage: UsageStat;
  bandwidth: UsageStat;
  cost: { amount: number; currency: string };
  renewalDate: string;
  status: ServerStatus;
  lastCheckedAt: string;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

// --- Finance ---
export type TransactionType = "income" | "expense";
export type FinanceCategory = "Engineering" | "Design" | "HR" | "Finance" | "Sales" | "Marketing" | "Operations" | "Support" | "Other";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: FinanceCategory;
  description: string;
  date: string;
  recurring: boolean;
  attachmentUrl: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  profit: number;
  byCategory: { category: string; total: number }[];
  cashFlow: { date: string; income: number; expense: number }[];
}

// --- Assets ---
export type AssetCategory = "Laptop" | "Desktop" | "Monitor" | "Phone" | "Software License" | "Furniture" | "Networking" | "Other";
export type AssetStatus = "available" | "in_use" | "maintenance" | "retired";

export interface AssetRecord {
  id: string;
  label: string;
  category: AssetCategory;
  serialNumber: string;
  vendor: string;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  cost: { amount: number; currency: string };
  assignedTo?: Pick<Employee, "id" | "name" | "employeeId" | "photoUrl"> | null;
  status: AssetStatus;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

// --- Clients ---
export type ClientStatus = "active" | "inactive" | "prospect";

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  status: ClientStatus;
  contractValue: { amount: number; currency: string };
  accountManager?: User | null;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

// --- Vendors ---
export type VendorStatus = "active" | "inactive";

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  status: VendorStatus;
  contractValue: { amount: number; currency: string };
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

// --- Departments & Teams ---
export interface DepartmentRecord {
  id: string;
  name: string;
  description: string;
  manager?: Pick<Employee, "id" | "name" | "employeeId" | "photoUrl"> | null;
  color: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  department?: Pick<DepartmentRecord, "id" | "name" | "color"> | null;
  lead?: Pick<Employee, "id" | "name" | "employeeId" | "photoUrl"> | null;
  members: Pick<Employee, "id" | "name" | "employeeId" | "photoUrl">[];
  description: string;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}
