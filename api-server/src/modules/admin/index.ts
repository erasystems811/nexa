/**
 * Admin — the Admin Console's server logic. Internal ops only.
 *
 * Owns: vendor approval, listing approval, booking monitoring, PAYING VENDORS
 * out of the money Nexa is holding, refunds, dispute resolution, the
 * suspension/appeal/strike workflow, the monthly vendor fee, and audit_log.
 *
 * Runs on the service role AFTER requirePermission(...) in the route — the
 * permission check is the gate, the service role is what executes once past
 * it, the same trust pattern the payments module uses. Every state change
 * writes an audit_log row naming the acting admin.
 *
 * It calls ../payments for anything that moves money; it never touches a
 * processor, and there is no strike-count threshold that removes a provider
 * automatically — removal is always a manual decision.
 */
export { AdminError, audit } from "./context.js";
export {
  PERMISSIONS, PERMISSION_LABELS, ALL_PERMISSIONS,
  STAFF_ROLES, STAFF_ROLE_LABELS, ROLE_BUNDLES, bundleFor,
  type Permission, type StaffRole,
} from "./permissions.js";
export {
  currentStaff, requireStaff, requirePermission, can,
  listStaff, getStaffMember, inviteStaff, setStaffRole,
  toggleStaffPermission, setStaffStatus, recordLogin,
  staffActivity, activityFeed, ensureEnvSuperAdmin,
  type StaffContext, type StaffInviteResult,
} from "./staff.js";
export { adminDashboard } from "./dashboard.js";
export {
  listCategoriesForAdmin, setCategoryImage, removeCategoryImage, setCategoryVendorTier,
  type AdminCategory,
} from "./categories.js";
export {
  listProviders, getProviderDetail, approveProvider, approveProviderAndListings, rejectProvider,
  setProviderSuspended, setProviderFeatured, addProviderManually,
  providerIdentity, decideDocument,
  type ManualProviderResult, type AdminIdDocument,
} from "./providers.js";
export {
  recordNoShow, listStrikes, resolveAppeal, removeProvider,
} from "./strikes.js";
export {
  listingQueue, listAllListings, getListingForReview, decideListing,
  restoreListing, decideMedia,
} from "./listings.js";
export { listOrders, getOrderDetail, overrideStatus } from "./orders.js";
export { listCustomers, getCustomerDetail } from "./customers.js";
export {
  moneyOverview, vendorsWaitingToBePaid, recentMoneyMoves, bookingMoney,
  releaseToVendor, adminRefund,
  type MoneyOverview, type BookingMoney,
} from "./payments.js";
export {
  listSubscriptions, subscriptionOverview, getProviderSubscription,
  markSubscriptionPaid, setSubscriptionStatus,
  SUBSCRIPTION_STATUSES, SUBSCRIPTION_STATUS_COPY,
  type SubscriptionStatus,
} from "./subscriptions.js";
export { listDisputes, getDisputeDetail, resolveDispute, payVendorAndResolve, refundCustomerAndResolve } from "./disputes.js";
export { listFlags, resolveFlag, convertFlagToStrike } from "./moderation.js";
export {
  listSupportRequests, assignSupportRequest, resolveSupportRequest,
  listNotificationNumbers, addNotificationNumber, removeNotificationNumber,
} from "./support.js";
