/**
 * Provider — Business Studio's server logic, and the public application that
 * creates a vendor in the first place.
 *
 * Owns: providers, provider_categories, provider_documents, provider_strikes,
 * provider_reliability, provider_wallets, and the provider's own view of
 * listings, media, availability, orders, and reviews.
 *
 * A provider only ever touches their own business. That is enforced in RLS and
 * the guard triggers, not by this module remembering to filter — but every
 * query here is written provider-scoped anyway, as defence in depth.
 *
 * What a provider CANNOT do, by database rule: approve their own listing or
 * media, approve their own business, feature it, write their own wallet balance,
 * or edit a review's scores.
 */
export { ProviderError, currentProvider, requireProvider } from "./context";
export { providerDashboard } from "./dashboard";
export { updateProfile, getContact, updateContact, type ProfileUpdate } from "./profile";
export { submitApplication, type ApplicationInput } from "./apply";
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
} from "./identification";
export {
  listMyListings,
  getMyListing,
  createListing,
  updateListing,
  setListingPaused,
  deleteListing,
  duplicateListing,
  type ListingInput,
} from "./listings";
export { listMedia, uploadMedia, deleteMedia } from "./media";
export { listAvailability, blockUnavailable, removeBlock } from "./availability";
export { listProviderOrders, accept, reject, startWork } from "./orders";
export { getWallet, updateBankDetails } from "./wallet";
export { listMyReviews, replyToReview } from "./reviews";
export { mySubscription, isListable } from "./subscription";
export { myApplication } from "./apply";
