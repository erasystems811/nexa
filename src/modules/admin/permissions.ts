/**
 * The permission catalogue and role bundles. PRD Addendum v1.1 §4.
 *
 * Authorisation is permission-based, not role-based: a staff member holds a set
 * of permission keys, and every privileged action checks for a specific key.
 * A role is just a convenient default bundle — a Super Admin can grant or revoke
 * any individual permission from any account, so the effective set is what is
 * stored on the staff record, not what the role implies.
 *
 * Assigning a role gives someone the views that role bundles; granting extra
 * permissions gives them more views. Every view maps to a permission below.
 */

export const PERMISSIONS = {
  // Providers (both Service and Product vendors are Provider records).
  providersView: "providers.view",
  providersApprove: "providers.approve",
  providersEdit: "providers.edit",
  providersSuspend: "providers.suspend",
  providersRemove: "providers.remove",
  // Riders.
  ridersView: "riders.view",
  ridersVerify: "riders.verify",
  ridersSuspend: "riders.suspend",
  ridersReassign: "riders.reassign",
  // Listings.
  listingsView: "listings.view",
  listingsApprove: "listings.approve",
  // Orders.
  ordersView: "orders.view",
  ordersOverride: "orders.override",
  // Customers & support.
  customersView: "customers.view",
  supportHandle: "support.handle",
  // Disputes.
  disputesView: "disputes.view",
  disputesResolve: "disputes.resolve",
  // Reviews.
  reviewsView: "reviews.view",
  // Money.
  paymentsView: "payments.view",
  paymentsRefund: "payments.refund",
  paymentsPayout: "payments.payout",
  paymentsPenalty: "payments.penalty",
  // Settings.
  settingsManage: "settings.manage",
  settingsCommission: "settings.commission",
  // Moderation (contact-info flags).
  moderationView: "moderation.view",
  moderationResolve: "moderation.resolve",
  moderationStrike: "moderation.strike",
  // Reports.
  reportsView: "reports.view",
  reportsExport: "reports.export",
  // Staff administration.
  staffManage: "staff.manage",
  // Flagged-off features (Marketing) — the permission exists now; the features
  // stay behind their flags (PRD Section 17/18).
  promotionsManage: "promotions.manage",
  couponsManage: "coupons.manage",
  featuredManage: "featured.manage",
  notificationsSend: "notifications.send",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Human labels, for the staff-editor UI. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "providers.view": "View providers",
  "providers.approve": "Approve / reject providers",
  "providers.edit": "Edit providers, feature",
  "providers.suspend": "Suspend, discipline, appeals",
  "providers.remove": "Remove providers permanently",
  "riders.view": "View riders",
  "riders.verify": "Verify riders & documents",
  "riders.suspend": "Suspend riders",
  "riders.reassign": "Reassign deliveries",
  "listings.view": "View listings",
  "listings.approve": "Approve / reject listings",
  "orders.view": "View orders",
  "orders.override": "Override booking status",
  "customers.view": "View customers",
  "support.handle": "Handle support & complaints",
  "disputes.view": "View disputes",
  "disputes.resolve": "Resolve disputes & damage claims",
  "reviews.view": "View reviews",
  "payments.view": "View escrow & revenue",
  "payments.refund": "Issue refunds",
  "payments.payout": "Approve payouts",
  "payments.penalty": "Apply penalties",
  "settings.manage": "Change platform settings & flags",
  "settings.commission": "Change commission",
  "moderation.view": "View flagged messages",
  "moderation.resolve": "Confirm / dismiss flags",
  "moderation.strike": "Convert a flag to a strike",
  "reports.view": "View reports",
  "reports.export": "Export reports",
  "staff.manage": "Manage staff & permissions",
  "promotions.manage": "Manage promotions",
  "coupons.manage": "Manage coupons",
  "featured.manage": "Manage featured vendors",
  "notifications.send": "Send notifications",
};

export const STAFF_ROLES = [
  "super_admin",
  "rider_operations",
  "service_vendor_manager",
  "product_vendor_manager",
  "customer_support",
  "finance",
  "marketing",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  rider_operations: "Rider Operations",
  service_vendor_manager: "Service Vendor Manager",
  product_vendor_manager: "Product Vendor Manager",
  customer_support: "Customer Support",
  finance: "Finance",
  marketing: "Marketing",
};

const P = PERMISSIONS;

/**
 * The default permission bundle per role (Addendum §4). Super Admin is handled
 * specially — it holds every permission, present and future, so it is not
 * enumerated here.
 */
export const ROLE_BUNDLES: Record<Exclude<StaffRole, "super_admin">, Permission[]> = {
  rider_operations: [P.ridersView, P.ridersVerify, P.ridersSuspend, P.ridersReassign, P.ordersView],
  service_vendor_manager: [
    P.providersView, P.providersApprove, P.providersEdit, P.providersSuspend,
    P.listingsView, P.listingsApprove, P.ordersView, P.reviewsView,
  ],
  product_vendor_manager: [
    P.providersView, P.providersApprove, P.providersEdit, P.providersSuspend,
    P.listingsView, P.listingsApprove, P.ordersView,
  ],
  customer_support: [
    P.customersView, P.supportHandle, P.disputesView, P.disputesResolve,
    P.paymentsRefund, P.moderationView, P.moderationResolve, P.ordersView,
  ],
  finance: [P.paymentsView, P.paymentsRefund, P.paymentsPayout, P.paymentsPenalty, P.reportsView, P.reportsExport],
  marketing: [P.promotionsManage, P.couponsManage, P.featuredManage, P.notificationsSend],
};

/** The default permissions a role starts with. Super Admin means "everything". */
export function bundleFor(role: StaffRole): Permission[] {
  return role === "super_admin" ? ALL_PERMISSIONS : ROLE_BUNDLES[role];
}
