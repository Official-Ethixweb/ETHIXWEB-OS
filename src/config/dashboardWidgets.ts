export interface DashboardWidgetDef {
  id: string;
  title: string;
  /** Any one of these permissions grants visibility; omit for widgets everyone with dashboard access sees. */
  permissionAnyOf?: string[];
  defaultLayout: { x: number; y: number; w: number; h: number };
  minW?: number;
  minH?: number;
}

// 12-column grid. Order here is also the default vertical order — exact `y`
// values don't need to be gap-free, react-grid-layout's vertical compaction
// closes gaps on load.
export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  { id: "kpi-overview", title: "KPI overview", defaultLayout: { x: 0, y: 0, w: 12, h: 5 }, minH: 4 },
  { id: "task-overview", title: "Task overview", defaultLayout: { x: 0, y: 5, w: 12, h: 5 }, minH: 4 },
  { id: "finance-kpis", title: "Finance KPIs", permissionAnyOf: ["finance.view"], defaultLayout: { x: 0, y: 10, w: 12, h: 5 }, minH: 4 },
  { id: "team-pulse", title: "Team pulse", defaultLayout: { x: 0, y: 15, w: 12, h: 6 }, minH: 5 },
  { id: "upcoming-events", title: "Upcoming birthdays & anniversaries", defaultLayout: { x: 0, y: 21, w: 8, h: 7 }, minW: 4, minH: 5 },
  { id: "mini-calendar", title: "Calendar", defaultLayout: { x: 8, y: 21, w: 4, h: 7 }, minW: 3, minH: 5 },
  { id: "project-analytics", title: "Project analytics", defaultLayout: { x: 0, y: 28, w: 12, h: 9 }, minH: 6 },
  { id: "momentum", title: "Momentum", defaultLayout: { x: 0, y: 37, w: 12, h: 6 }, minH: 4 },
  { id: "activity-and-projects", title: "Activity & projects", defaultLayout: { x: 0, y: 43, w: 12, h: 9 }, minH: 6 },
  { id: "finance-charts", title: "Expense & income trends", permissionAnyOf: ["finance.view"], defaultLayout: { x: 0, y: 52, w: 12, h: 9 }, minH: 6 },
  { id: "finance-breakdown", title: "Expense & payroll breakdown", permissionAnyOf: ["finance.view"], defaultLayout: { x: 0, y: 61, w: 12, h: 8 }, minH: 6 },
  { id: "infra-tiles", title: "Infrastructure overview", permissionAnyOf: ["subscriptions.view", "domains.view", "servers.view"], defaultLayout: { x: 0, y: 69, w: 12, h: 6 }, minH: 4 },
  { id: "infra-charts", title: "Infrastructure cost charts", permissionAnyOf: ["subscriptions.view", "domains.view", "servers.view"], defaultLayout: { x: 0, y: 75, w: 12, h: 8 }, minH: 6 },
  { id: "infra-cost-comparison", title: "Infrastructure cost comparison", permissionAnyOf: ["subscriptions.view", "domains.view", "servers.view"], defaultLayout: { x: 0, y: 83, w: 12, h: 7 }, minH: 5 },
  { id: "hr-stats", title: "Attendance & leave rates", permissionAnyOf: ["employees.manage"], defaultLayout: { x: 0, y: 90, w: 12, h: 5 }, minH: 4 },
  { id: "hr-charts", title: "Employee growth & departments", permissionAnyOf: ["employees.manage"], defaultLayout: { x: 0, y: 95, w: 12, h: 8 }, minH: 6 },
  { id: "hr-attendance-trend", title: "Attendance trend", permissionAnyOf: ["employees.manage"], defaultLayout: { x: 0, y: 103, w: 12, h: 7 }, minH: 5 },
];

export function baseWidgetId(instanceId: string): string {
  const idx = instanceId.indexOf("--copy-");
  return idx === -1 ? instanceId : instanceId.slice(0, idx);
}
