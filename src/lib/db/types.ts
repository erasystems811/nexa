/**
 * Domain types for Nexa.
 *
 * `generated.ts` is produced by `npm run db:types` from the live schema and is
 * never edited by hand. This file is the thin, readable layer over it: the row
 * aliases the app actually names, plus the few helpers that belong with them.
 *
 * Deriving from the generated file rather than restating it means a column
 * renamed in a migration breaks the build, instead of quietly returning
 * undefined at runtime.
 */

import type { Database as Generated } from "./generated";

export type Database = Generated;

type Row<T extends keyof Generated["public"]["Tables"]> =
  Generated["public"]["Tables"][T]["Row"];
type Enum<T extends keyof Generated["public"]["Enums"]> = Generated["public"]["Enums"][T];

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type UserRole = Enum<"user_role">;
export type FulfillmentType = Enum<"fulfillment_type">;
export type BookingStatus = Enum<"booking_status">;
export type PaymentStatus = Enum<"payment_status">;
export type PaymentLedgerKind = Enum<"payment_ledger_kind">;
export type VerificationStatus = Enum<"verification_status">;
export type ListingStatus = Enum<"listing_status">;
export type PaymentType = Enum<"payment_type">;
export type PriceType = Enum<"price_type">;
export type ModerationFlagReason = Enum<"moderation_flag_reason">;
export type ModerationFlagStatus = Enum<"moderation_flag_status">;
export type SubscriptionStatus = Enum<"subscription_status">;
export type MessageOrigin = Enum<"message_origin">;

/** Runtime lists, for iterating a <select> or validating input. */
export const USER_ROLES = ["admin", "provider", "customer"] as const satisfies
  readonly UserRole[];

/**
 * Nexa sells services. A vendor either comes to the customer's event, or the
 * customer comes to the vendor. Nothing is delivered and nothing is returned.
 */
export const FULFILLMENT_TYPES = [
  "onsite_service",
  "vendor_location_service",
] as const satisfies readonly FulfillmentType[];

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  onsite_service: "Vendor comes to the event",
  vendor_location_service: "Customer goes to the vendor",
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type Profile = Row<"profiles">;
export type FeatureFlag = Row<"feature_flags">;
export type PlatformSetting = Row<"platform_settings">;
export type City = Row<"cities">;
export type Category = Row<"categories">;
export type Provider = Row<"providers">;
export type ProviderSubscription = Row<"provider_subscriptions">;
export type SubscriptionPayment = Row<"subscription_payments">;
export type Listing = Row<"listings">;
export type Booking = Row<"bookings">;
export type Payment = Row<"payments">;
export type PaymentLedgerEntry = Row<"payment_ledger_entries">;
export type Conversation = Row<"conversations">;
export type Message = Row<"messages">;
export type ModerationFlag = Row<"moderation_flags">;
export type Review = Row<"reviews">;
export type Dispute = Row<"disputes">;
export type EventProject = Row<"event_projects">;
