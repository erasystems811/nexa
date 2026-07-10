/**
 * Provider — Business Studio's server logic. PRD Sections 05, 13.
 *
 * Owns: providers, provider_categories, provider_documents, provider_agreements,
 * provider_strikes, provider_reliability, provider_wallets, and the provider's
 * own view of listings, media, availability, orders, and reviews.
 *
 * A provider only ever touches their own business. That is enforced in RLS and
 * the guard triggers, not by this module remembering to filter — but every
 * query here is written provider-scoped anyway, as defence in depth.
 *
 * What a provider CANNOT do, by database rule: approve their own listing or
 * media, set their deposit % or penalty terms (Admin's, Section 05), feature
 * their own business, write their own wallet balance, or edit a review's scores.
 */
export { ProviderError, currentProvider, requireProvider } from "./context";
export { providerDashboard } from "./dashboard";
export { updateProfile, getContact, updateContact, getAgreement, type ProfileUpdate } from "./profile";
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
export { listProviderOrders, accept, reject, markReady, checkIn } from "./orders";
export { getWallet, updateBankDetails } from "./wallet";
export { listMyReviews, replyToReview } from "./reviews";
