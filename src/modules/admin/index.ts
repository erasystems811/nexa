/**
 * Admin — the Admin Console's server logic. Internal ops only.
 *
 * Owns: vendor approval, listing approval, booking monitoring, PAYING VENDORS
 * out of the money Nexa is holding, refunds, dispute resolution, the
 * suspension/appeal/strike workflow, the monthly vendor fee, and audit_log.
 *
 * Runs on the service role AFTER requireRole("admin") in the server action —
 * the role check is the gate, the service role is what executes once past it,
 * the same trust pattern the payments module uses. Every state change writes an
 * audit_log row naming the acting admin.
 *
 * It calls @/modules/payments for anything that moves money; it never touches a
 * processor, and there is no strike-count threshold that removes a provider
 * automatically — removal is always a manual decision.
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
  type StaffContext, type StaffInviteResult,
} from "./staff";
export { adminDashboard } from "./dashboard";
export {
  listProviders, getProviderDetail, approveProvider, rejectProvider,
  setProviderSuspended, setProviderFeatured, addProviderManually,
  providerIdentity, decideDocument,
  type ManualProviderResult, type AdminIdDocument,
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
  moneyOverview, vendorsWaitingToBePaid, recentMoneyMoves, bookingMoney,
  releaseToVendor, adminRefund,
  type MoneyOverview, type BookingMoney,
} from "./payments";
export {
  listSubscriptions, subscriptionOverview, getProviderSubscription,
  markSubscriptionPaid, setSubscriptionStatus,
  SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_COPY,
  type SubscriptionStatus,
} from "./subscriptions";
export { listDisputes, getDisputeDetail, resolveDispute } from "./disputes";
export { listFlags, resolveFlag, convertFlagToStrike } from "./moderation";
