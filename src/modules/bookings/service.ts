import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePayout, holdFunds, refund, releaseFunds } from "@/modules/payments";
import { publicEnv } from "@/lib/env";
import { assertTransition, checkpointsFor } from "./state";
import type { BookingStatus, Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export class BookingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingsError";
  }
}

/**
 * The booking engine. PRD Sections 07, 09, 10.
 *
 * It never calls a payment processor. It calls `@/modules/payments`, which is
 * the only thing that knows one exists (Section 17). ESLint enforces that.
 *
 * It never decides a price either — `price_booking_from_listing` (0016) does,
 * inside the database, from the listing or from an accepted offer. A client can
 * post whatever it likes into `agreed_price_kobo`; the trigger overwrites it.
 */

export interface CheckoutInput {
  listingId: string;
  scheduledStart: string;
  scheduledEnd?: string | null;
  address?: string;
  notes?: string;
}

export interface CheckoutResult {
  bookingId: string;
  reference: string;
  checkoutUrl?: string;
}

/**
 * Creates the booking, holds the money, mints the confirmation codes.
 *
 * The row is inserted with the *caller's* client so RLS and the pricing trigger
 * both apply. Everything after the hold runs on the service role, because a
 * customer must not be able to mark their own booking paid.
 */
export async function checkout(
  input: CheckoutInput,
  customer: { id: string; email: string; name?: string },
  /**
   * The customer's own client. Defaults to the request-scoped one. Injectable so
   * this can be driven from a script — and so the seam is explicit: whatever is
   * passed here MUST be a client bound to `customer`, never the service role,
   * or the pricing trigger stops applying.
   */
  callerClient?: SupabaseClient<Database>,
): Promise<CheckoutResult> {
  const supabase = callerClient ?? (await createClient());

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, provider_id, payment_type, price_type, title")
    .eq("id", input.listingId)
    .single();

  if (listingError || !listing) {
    throw new BookingsError("That listing is not available");
  }

  // Deposit listings need a second collection before stage 1, which is not
  // built. Failing loudly beats holding the wrong amount and discovering it at
  // payout time.
  if (listing.payment_type === "deposit") {
    throw new BookingsError(
      "Deposit checkout is not implemented yet. This listing takes a deposit, " +
        "which needs a balance-collection step before the provider is paid.",
    );
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      customer_id: customer.id,
      provider_id: listing.provider_id,
      listing_id: listing.id,
      scheduled_start: input.scheduledStart,
      scheduled_end: input.scheduledEnd ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      status: "pending",
      // Overwritten by the pricing trigger. Present because the column is NOT NULL.
      agreed_price_kobo: 0,
      fulfillment_type: "onsite_service",
      commission_percent: 0,
      stage_1_release_percent: 0,
    })
    .select("id, reference, agreed_price_kobo, delivery_fee_kobo, caution_fee_kobo, commission_percent")
    .single();

  if (bookingError || !booking) {
    throw new BookingsError(bookingError?.message ?? "Could not create the booking");
  }

  const { commissionKobo } = calculatePayout({
    agreedPriceKobo: booking.agreed_price_kobo,
    commissionPercent: booking.commission_percent,
    stage1ReleasePercent: 0,
    latePenaltyPercentPer30Min: 0,
  });

  try {
    const { checkoutUrl } = await holdFunds({
      bookingId: booking.id,
      reference: booking.reference,
      amountKobo: booking.agreed_price_kobo,
      deliveryFeeKobo: booking.delivery_fee_kobo,
      cautionFeeKobo: booking.caution_fee_kobo,
      commissionKobo,
      customer,
      redirectUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/orders/${booking.id}`,
    });

    // Codes are minted by a trigger on this transition (0007). Nothing mints
    // them earlier, because a booking nobody has paid for has nothing to confirm.
    await transition(booking.id, "paid_held");

    return { bookingId: booking.id, reference: booking.reference, checkoutUrl };
  } catch (error) {
    // The booking exists but the money did not move. Leave no half-booking
    // occupying the provider's calendar.
    await createAdminClient()
      .from("bookings")
      .update({ status: "cancelled", cancellation_reason: "Payment failed" })
      .eq("id", booking.id);

    throw new BookingsError(
      error instanceof Error ? error.message : "Payment could not be completed",
    );
  }
}

/** Moves a booking through the Section 09 state machine, or refuses to. */
async function transition(bookingId: string, to: BookingStatus) {
  const db = createAdminClient();

  const { data: current } = await db
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .single();

  if (!current) throw new BookingsError("No such booking");
  assertTransition(current.status, to);

  const now = new Date().toISOString();
  const stamps: Record<string, string> = {};
  if (to === "accepted") stamps.accepted_at = now;
  if (to === "rejected") stamps.rejected_at = now;
  if (to === "cancelled") stamps.cancelled_at = now;
  if (to === "completed") stamps.completed_at = now;

  const { error } = await db
    .from("bookings")
    .update({ status: to, ...stamps })
    .eq("id", bookingId);

  if (error) throw new BookingsError(`Could not update the booking: ${error.message}`);
}

/**
 * Legacy compatibility helper. Addendum v1.2 moves ordinary delivery/setup
 * responsibility to the provider; new code should use provider-owned
 * fulfillment actions instead of Nexa rider pickup.
 */
export async function markReadyForPickup(bookingId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ ready_for_pickup_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) throw new BookingsError(error.message);
}

/** Provider confirms. PRD Section 09: the customer's free-cancellation window closes. */
export async function acceptBooking(bookingId: string): Promise<void> {
  await transition(bookingId, "accepted");
}

/**
 * Provider declines. "Customer refunded automatically, no admin needed."
 * Section 09.
 */
export async function rejectBooking(bookingId: string, reason?: string): Promise<void> {
  const db = createAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("agreed_price_kobo, delivery_fee_kobo, caution_fee_kobo")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new BookingsError("No such booking");

  await refund({
    bookingId,
    amountKobo:
      booking.agreed_price_kobo + booking.delivery_fee_kobo + booking.caution_fee_kobo,
    reason: reason ?? "Provider rejected the booking",
  });

  await transition(bookingId, "rejected");
}

/**
 * Stage 1. PRD Section 10 — the checkpoint differs per fulfillment type, and
 * for Delivery + Return it is the customer's first code.
 *
 * Nobody "marks it done": for the code-bearing type the code is verified here,
 * and for the others the caller is a provider-owned operational checkpoint.
 */
export async function recordStage1(
  bookingId: string,
  options: { code?: string } = {},
): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, status, provider_id, fulfillment_type, agreed_price_kobo, commission_percent, stage_1_release_percent")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new BookingsError("No such booking");
  assertTransition(booking.status, "in_progress");

  const checkpoint = checkpointsFor(booking.fulfillment_type);
  if (checkpoint.stage1NeedsCode) {
    await consumeCode(bookingId, 1, options.code);
  }

  const { stage1Kobo } = calculatePayout({
    agreedPriceKobo: booking.agreed_price_kobo,
    commissionPercent: booking.commission_percent,
    stage1ReleasePercent: booking.stage_1_release_percent,
    latePenaltyPercentPer30Min: 0,
  });

  if (stage1Kobo > 0) {
    await releaseFunds({
      bookingId,
      stage: 1,
      amountKobo: stage1Kobo,
      beneficiary: await providerBeneficiary(booking.provider_id),
    });
  }

  await db
    .from("bookings")
    .update({ status: "in_progress", stage_1_at: new Date().toISOString() })
    .eq("id", bookingId);
}

/**
 * Stage 2, and the end of the booking. Always gated on the customer's code —
 * this is the sentence in Section 10 that the whole platform rests on: money
 * moves "only when a real, verifiable checkpoint has passed", "never on a
 * provider simply tapping "done" without the required checkpoint."
 */
export async function confirmWithCode(bookingId: string, code: string): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, status, provider_id, fulfillment_type, agreed_price_kobo, commission_percent, stage_1_release_percent")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new BookingsError("No such booking");
  assertTransition(booking.status, "completed");

  await consumeCode(bookingId, 2, code);

  const { stage2Kobo } = calculatePayout({
    agreedPriceKobo: booking.agreed_price_kobo,
    commissionPercent: booking.commission_percent,
    stage1ReleasePercent: booking.stage_1_release_percent,
    latePenaltyPercentPer30Min: 0,
  });

  if (stage2Kobo > 0) {
    await releaseFunds({
      bookingId,
      stage: 2,
      amountKobo: stage2Kobo,
      beneficiary: await providerBeneficiary(booking.provider_id),
    });
  }

  await db
    .from("bookings")
    .update({ status: "completed", stage_2_at: new Date().toISOString(), completed_at: new Date().toISOString() })
    .eq("id", bookingId);
}

/**
 * A code is single-use. Verifying it and marking it consumed has to be one
 * statement, or the same code could be reused.
 */
async function consumeCode(bookingId: string, stage: 1 | 2, code?: string): Promise<void> {
  if (!code) throw new BookingsError("A confirmation code is required");

  const db = createAdminClient();
  const { data, error } = await db
    .from("booking_confirmation_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("stage", stage)
    .eq("code", code.trim().toUpperCase())
    .is("consumed_at", null)
    .select("id");

  if (error) throw new BookingsError(`Could not verify the code: ${error.message}`);
  if (!data || data.length === 0) {
    throw new BookingsError("That confirmation code is not valid, or has already been used");
  }
}

async function providerBeneficiary(providerId: string) {
  const db = createAdminClient();
  const { data: wallet } = await db
    .from("provider_wallets")
    .select("bank_code, bank_account_number")
    .eq("provider_id", providerId)
    .single();

  if (!wallet?.bank_code || !wallet.bank_account_number) {
    throw new BookingsError("That provider has no payout account on file");
  }

  return {
    kind: "provider" as const,
    id: providerId,
    bankCode: wallet.bank_code,
    accountNumber: wallet.bank_account_number,
  };
}
