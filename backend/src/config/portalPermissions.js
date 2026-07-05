// Separate, smaller permission registry for external portal users (vendors,
// clients) — deliberately not merged with config/permissions.js, since portal
// users never touch the internal RBAC system at all (see middleware/auth.js
// requirePortalAuth). Granted per-vendor/per-client as a flat array, editable
// by any staff member with vendors.manage / clients.manage — there's no
// "role" concept here, just a direct grant list per external party.
const VENDOR_PORTAL_PERMISSIONS = [
  { key: 'projects.view_assigned', label: 'View assigned projects' },
  { key: 'tasks.view_assigned', label: 'View assigned tasks' },
  { key: 'documents.view', label: 'View shared documents' },
  { key: 'invoices.view', label: 'View invoices' },
  { key: 'timeline.view', label: 'View project timeline' },
];

const CLIENT_PORTAL_PERMISSIONS = [
  { key: 'progress.view', label: 'View project progress' },
  { key: 'invoices.view', label: 'View invoices' },
  { key: 'timeline.view', label: 'View timeline' },
  { key: 'documents.view', label: 'View shared files' },
  { key: 'milestones.view', label: 'View milestones' },
  { key: 'approvals.manage', label: 'Approve or reject milestones' },
  { key: 'reports.view', label: 'View reports' },
];

const VENDOR_PORTAL_KEYS = VENDOR_PORTAL_PERMISSIONS.map((p) => p.key);
const CLIENT_PORTAL_KEYS = CLIENT_PORTAL_PERMISSIONS.map((p) => p.key);

module.exports = { VENDOR_PORTAL_PERMISSIONS, CLIENT_PORTAL_PERMISSIONS, VENDOR_PORTAL_KEYS, CLIENT_PORTAL_KEYS };
