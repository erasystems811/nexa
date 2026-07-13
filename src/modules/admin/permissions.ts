/**
 * The permission catalogue and role bundles.
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
  // Vendors. Every vendor on Nexa sells a service; there is no product vendor.
  providersView: "providers.view",
  providersApprove: "providers.approve",
  providersEdit: "providers.edit",
  providersSuspend: "providers.suspend",
  providersRemove: "providers.remove",
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
  // The monthly platform fee — Nexa's second revenue line beside commission.
  subscriptionsView: "subscriptions.view",
  subscriptionsManage: "subscriptions.manage",
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
  // stay behind their flags/18).
  promotionsManage: "promotions.manage",
  couponsManage: "coupons.manage",
  featuredManage: "featured.manage",
  notificationsSend: "notifications.send",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Human labels, for the staff-editor UI. */
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
  "payments.view": "View escrow & revenue",
  "payments.refund": "Issue refunds",
  "payments.payout": "Approve payouts",
  "payments.penalty": "Apply penalties",
  "subscriptions.view": "View vendor subscriptions",
  "subscriptions.manage": "Record subscription payments, cancel & reactivate",
  "settings.manage": "Change platform settings & features",
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

/** Mirrors the staff_role enum exactly (migration 0028). */
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

const P = PERMISSIONS;

/**
 * The default permission bundle per role Super Admin is handled
 * specially — it holds every permission, present and future, so it is not
 * enumerated here.
 */
export const ROLE_BUNDLES: Record<Exclude<StaffRole, "super_admin">, Permission[]> = {
  vendor_manager: [
    P.providersView, P.providersApprove, P.providersEdit, P.providersSuspend,
    P.listingsView, P.listingsApprove, P.ordersView, P.reviewsView,
    // A vendor manager fields "why am I not showing up?" — they need to see the
    // subscription that answers it, but not to change it.
    P.subscriptionsView,
  ],
  customer_support: [
    P.customersView, P.supportHandle, P.disputesView, P.disputesResolve,
    P.paymentsRefund, P.moderationView, P.moderationResolve, P.ordersView,
  ],
  finance: [
    P.paymentsView, P.paymentsRefund, P.paymentsPayout, P.paymentsPenalty,
    P.subscriptionsView, P.subscriptionsManage,
    P.reportsView, P.reportsExport,
  ],
  marketing: [P.promotionsManage, P.couponsManage, P.featuredManage, P.notificationsSend],
};

/** The default permissions a role starts with. Super Admin means "everything". */
export function bundleFor(role: StaffRole): Permission[] {
  return role === "super_admin" ? ALL_PERMISSIONS : ROLE_BUNDLES[role];
}
