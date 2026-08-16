/**
 * Provider — Business Studio's server logic. Ported from apps/customer's
 * modules/provider/index.ts (the vendor application flow, apply.ts, is not
 * ported yet — /apply stays on apps/customer for now).
 *
 * Owns: providers, provider_categories, provider_documents, provider_strikes,
 * provider_reliability, provider_wallets, and the provider's own view of
 * listings, media, availability, orders, and reviews.
 *
 * What a provider CANNOT do, by database rule: approve their own listing or
 * media, approve their own business, feature it, write their own wallet
 * balance, or edit a review's scores. This module is defense-in-depth; RLS
 * and the guard triggers are the real boundary.
 */
export { ProviderError, currentProvider, requireProvider } from "./context.js";
export { providerDashboard } from "./dashboard.js";
export { updateProfile, getContact, updateContact, uploadProfilePhoto, type ProfileUpdate } from "./profile.js";
export {
  ID_TYPES,
  ACCEPTED_ID_MIME_TYPES,
  REQUIRED_ID_COUNT,
  NOT_VERIFIED_MESSAGE,
  isIdentityVerified,
  idTypeLabel,
  myIdentityStatus,
  providerIsVerified,
  submitIdDocument,
  type IdType,
  type IdSubmission,
  type IdentityStatus,
} from "./identification.js";
export {
  listMyListings,
  getMyListing,
  createListing,
  updateListing,
  setListingPaused,
  deleteListing,
  duplicateListing,
  type ListingInput,
} from "./listings.js";
export { listMedia, uploadMedia, deleteMedia } from "./media.js";
export { listAvailability, blockUnavailable, removeBlock } from "./availability.js";
export { listProviderOrders, accept, reject, startWork, enterCompletionCode, reportProblem } from "./orders.js";
export { getWallet, updateBankDetails } from "./wallet.js";
export { listMyReviews, replyToReview } from "./reviews.js";
export { mySubscription, isListable } from "./subscription.js";
