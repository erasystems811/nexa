/**
 * Admin — the Admin Console's server logic. PRD Section 12. Internal ops only.
 *
 * Owns: verification queues, listing approval, order monitoring, dispute and
 * caution resolution, the suspension/appeal/strike workflow, payment
 * interventions, reports, and audit_log.
 *
 * Runs on the service role AFTER requireRole("admin") in the server action —
 * the role check is the gate, the service role is what executes once past it,
 * the same trust pattern the payments module uses. Every state change writes an
 * audit_log row naming the acting admin.
 *
 * It calls @/modules/payments for anything that moves money; it never touches a
 * processor, and there is no strike-count threshold that removes a provider
 * automatically — removal is always a manual decision (Section 05).
 */
export { AdminError, audit } from "./context";
export {
  PERMISSIONS, PERMISSION_LABELS, ALL_PERMISSIONS,
  STAFF_ROLES, STAFF_ROLE_LABELS, ROLE_BUNDLES, bundleFor,
  type Permission, type StaffRole,
} from "./permissions";
export {
  currentStaff, requireStaff, requirePermission, requireView, can,
  listStaff, getStaffMember, inviteStaff, setStaffRole,
  toggleStaffPermission, setStaffStatus, recordLogin,
  staffActivity, activityFeed,
  type StaffContext,
} from "./staff";
export { adminDashboard } from "./dashboard";
export {
  listProviders, getProviderDetail, approveProvider, rejectProvider,
  setProviderSuspended, setProviderFeatured, addProviderManually,
} from "./providers";
export {
  recordNoShow, listStrikes, resolveAppeal, removeProvider,
} from "./strikes";
export {
  listingQueue, listAllListings, getListingForReview, decideListing,
  restoreListing, decideMedia,
} from "./listings";
export { listOrders, getOrderDetail, overrideStatus } from "./orders";
export { listCustomers, getCustomerDetail } from "./customers";
export {
  paymentOverview, recentLedger, pendingPayouts,
  adminApplyPenalty, adminRefund, adminResolveCautionClaim,
} from "./payments";
export { listDisputes, getDisputeDetail, resolveDispute } from "./disputes";
export { reports } from "./reports";
export { listFlags, resolveFlag, convertFlagToStrike } from "./moderation";
