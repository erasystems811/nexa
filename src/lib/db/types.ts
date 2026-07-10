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
export type VehicleType = Enum<"vehicle_type">;
export type BookingStatus = Enum<"booking_status">;
export type PaymentStatus = Enum<"payment_status">;
export type PaymentLedgerKind = Enum<"payment_ledger_kind">;
export type VerificationStatus = Enum<"verification_status">;
export type ListingStatus = Enum<"listing_status">;
export type PaymentType = Enum<"payment_type">;
export type PriceType = Enum<"price_type">;
export type ModerationFlagReason = Enum<"moderation_flag_reason">;
export type ModerationFlagStatus = Enum<"moderation_flag_status">;
export type CallStatus = Enum<"call_status">;
export type RiderAssignmentStatus = Enum<"rider_assignment_status">;

/** Runtime lists, for iterating a <select> or validating input. */
export const USER_ROLES = ["admin", "provider", "customer", "rider"] as const satisfies
  readonly UserRole[];

export const FULFILLMENT_TYPES = [
  "delivery",
  "delivery_return",
  "onsite_service",
  "vendor_location_service",
] as const satisfies readonly FulfillmentType[];

export const VEHICLE_TYPES = ["bike", "car", "van"] as const satisfies readonly VehicleType[];

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type Profile = Row<"profiles">;
export type FeatureFlag = Row<"feature_flags">;
export type PlatformSetting = Row<"platform_settings">;
export type City = Row<"cities">;
export type Category = Row<"categories">;
export type Provider = Row<"providers">;
export type Rider = Row<"riders">;
export type Listing = Row<"listings">;
export type Booking = Row<"bookings">;
export type Payment = Row<"payments">;
export type PaymentLedgerEntry = Row<"payment_ledger_entries">;
export type Conversation = Row<"conversations">;
export type Message = Row<"messages">;
export type CallSession = Row<"call_sessions">;
export type ModerationFlag = Row<"moderation_flags">;
export type Review = Row<"reviews">;
export type Dispute = Row<"disputes">;
export type EventProject = Row<"event_projects">;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Does this fulfillment type ever involve a Nexa rider? PRD Section 15. */
export function fulfillmentUsesRider(type: FulfillmentType): boolean {
  return type === "delivery" || type === "delivery_return";
}
