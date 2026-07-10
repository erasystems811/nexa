/**
 * Domain enums, mirrored from supabase/migrations/0001_foundation.sql.
 *
 * The full row types come from `npm run db:types` once a Supabase project is
 * linked; that writes src/lib/db/generated.ts. Until then this file is the
 * hand-maintained subset the app actually reads.
 *
 * The row shapes below are `type` aliases, not `interface`s, and must stay that
 * way. postgrest-js constrains every Row to `Record<string, unknown>`; an
 * interface has no implicit index signature and fails that constraint, which
 * quietly collapses every table in the typed client to `never`.
 */

export const USER_ROLES = ["admin", "provider", "customer", "rider"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const FULFILLMENT_TYPES = [
  "delivery",
  "delivery_return",
  "onsite_service",
  "vendor_location_service",
] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const VEHICLE_TYPES = ["bike", "car", "van"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "paid_held",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "held",
  "partially_released",
  "released",
  "refunded",
  "partially_refunded",
  "failed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type VerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "suspended"
  | "removed";

/** Does this fulfillment type ever involve a Nexa rider? PRD Section 15. */
export function fulfillmentUsesRider(type: FulfillmentType): boolean {
  return type === "delivery" || type === "delivery_return";
}

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  avatar_url: string | null;
  city_id: string | null;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  label: string;
  description: string | null;
  enabled_for_roles: UserRole[] | null;
  is_locked: boolean;
  updated_at: string;
};

export type SettingValueType =
  | "number"
  | "percent"
  | "money_kobo"
  | "string"
  | "boolean"
  | "json";

export type PlatformSetting = {
  key: string;
  value: unknown;
  value_type: SettingValueType;
  label: string;
  description: string | null;
  min_value: number | null;
  max_value: number | null;
  updated_at: string;
};

export type City = {
  id: string;
  slug: string;
  name: string;
  state: string | null;
  country_code: string;
  is_active: boolean;
};

export type Category = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  fulfillment_type: FulfillmentType;
  delivery_mode: "rider" | "provider";
  requires_video_proof: boolean;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Payment = {
  id: string;
  booking_id: string;
  amount_kobo: number;
  delivery_fee_kobo: number;
  caution_fee_kobo: number;
  commission_kobo: number;
  status: PaymentStatus;
  held_kobo: number;
  released_kobo: number;
  refunded_kobo: number;
  penalty_kobo: number;
  caution_held_kobo: number;
  caution_refunded_kobo: number;
  caution_claimed_kobo: number;
  stage_1_released_at: string | null;
  stage_2_released_at: string | null;
  gateway: string | null;
  gateway_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentLedgerKind =
  | "hold"
  | "stage_release"
  | "commission"
  | "penalty"
  | "refund"
  | "caution_hold"
  | "caution_refund"
  | "caution_claim"
  | "rider_payout";

export type PaymentLedgerEntry = {
  id: string;
  payment_id: string;
  booking_id: string;
  kind: PaymentLedgerKind;
  /** Signed. Positive into the named party, negative out. */
  amount_kobo: number;
  provider_id: string | null;
  rider_id: string | null;
  customer_id: string | null;
  stage: 1 | 2 | null;
  note: string | null;
  created_at: string;
};

/**
 * Only the tables this phase touches. Extend by regenerating, not by hand,
 * once the schema is applied to a live project: `npm run db:types`.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      feature_flags: {
        Row: FeatureFlag;
        Insert: FeatureFlag;
        Update: Partial<FeatureFlag> & { updated_by?: string };
        Relationships: [];
      };
      platform_settings: {
        Row: PlatformSetting;
        Insert: PlatformSetting;
        Update: Partial<PlatformSetting> & { updated_by?: string };
        Relationships: [];
      };
      cities: {
        Row: City;
        Insert: Partial<City> & { slug: string; name: string };
        Update: Partial<City>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Partial<Category> & {
          slug: string;
          name: string;
          fulfillment_type: FulfillmentType;
        };
        Update: Partial<Category>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & { booking_id: string; amount_kobo: number };
        Update: Partial<Payment>;
        Relationships: [];
      };
      payment_ledger_entries: {
        Row: PaymentLedgerEntry;
        Insert: Partial<PaymentLedgerEntry> & {
          payment_id: string;
          booking_id: string;
          kind: PaymentLedgerKind;
          amount_kobo: number;
        };
        /**
         * Structurally present because postgrest-js requires it (a `never` here
         * makes Database fail `extends GenericSchema`, which silently degrades
         * every other table to `never`). The database rejects every UPDATE and
         * DELETE on this table — see reject_ledger_mutation in 0008_payments.sql.
         * The ledger is append-only whatever this type says.
         */
        Update: Partial<PaymentLedgerEntry>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      fulfillment_type: FulfillmentType;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
      vehicle_type: VehicleType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
