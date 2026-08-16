/**
 * Mirrors api-server's modules/admin/permissions.ts exactly — duplicated
 * client-side because the Admin Console UI needs to gate nav items and forms
 * on the same permission keys the server enforces. The server is still the
 * real authorization boundary; this only decides what to show.
 */

export const PERMISSIONS = {
  providersView: "providers.view",
  providersApprove: "providers.approve",
  providersEdit: "providers.edit",
  providersSuspend: "providers.suspend",
  providersRemove: "providers.remove",
  listingsView: "listings.view",
  listingsApprove: "listings.approve",
  ordersView: "orders.view",
  ordersOverride: "orders.override",
  customersView: "customers.view",
  supportHandle: "support.handle",
  disputesView: "disputes.view",
  disputesResolve: "disputes.resolve",
  reviewsView: "reviews.view",
  paymentsView: "payments.view",
  paymentsRefund: "payments.refund",
  paymentsPayout: "payments.payout",
  subscriptionsView: "subscriptions.view",
  subscriptionsManage: "subscriptions.manage",
  settingsManage: "settings.manage",
  moderationView: "moderation.view",
  moderationResolve: "moderation.resolve",
  moderationStrike: "moderation.strike",
  staffManage: "staff.manage",
  promotionsManage: "promotions.manage",
  featuredManage: "featured.manage",
  notificationsSend: "notifications.send",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const PERMISSION_LABELS: Record<Permission, string> = {
  "providers.view": "View vendors",
  "providers.approve": "Approve / reject vendors",
  "providers.edit": "Edit vendors, feature",
  "providers.suspend": "Suspend, discipline, appeals",
  "providers.remove": "Remove vendors permanently",
  "listings.view": "View services",
  "listings.approve": "Approve / reject services",
  "orders.view": "View bookings",
  "orders.override": "Override booking status",
  "customers.view": "View customers",
  "support.handle": "Handle support & complaints",
  "disputes.view": "View disputes",
  "disputes.resolve": "Resolve disputes",
  "reviews.view": "View reviews",
  "payments.view": "See the money Nexa is holding",
  "payments.refund": "Refund customers",
  "payments.payout": "Pay vendors",
  "subscriptions.view": "View vendor subscriptions",
  "subscriptions.manage": "Record subscription payments, cancel & reactivate",
  "settings.manage": "Change settings",
  "moderation.view": "View flagged messages",
  "moderation.resolve": "Confirm / dismiss flags",
  "moderation.strike": "Convert a flag to a strike",
  "staff.manage": "Manage staff & permissions",
  "promotions.manage": "Manage promotions",
  "featured.manage": "Manage featured vendors",
  "notifications.send": "Send notifications",
};

export const STAFF_ROLES = [
  "super_admin",
  "vendor_manager",
  "customer_support",
  "finance",
  "marketing",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  vendor_manager: "Vendor Manager",
  customer_support: "Customer Support",
  finance: "Finance",
  marketing: "Marketing",
};

export interface StaffContext {
  userId: string;
  staffId: string;
  role: StaffRole;
  permissions: Permission[];
  isSuperAdmin: boolean;
}

export function can(staff: StaffContext | null, permission: Permission): boolean {
  if (!staff) return false;
  return staff.isSuperAdmin || staff.permissions.includes(permission);
}
