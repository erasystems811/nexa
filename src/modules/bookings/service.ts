import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculatePayout, holdFunds, refund, releaseFunds } from "@/modules/payments";
import { publicEnv } from "@/lib/env";
import { assertTransition } from "./state";
import type { BookingStatus, Database } from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export class BookingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingsError";
  }
}

/**
 * The booking engine.
 *
 * It never calls a payment processor. It calls `@/modules/payments`, which is
 * the only thing that knows one exists. ESLint enforces that.
 *
 * It never decides a price either — `price_booking_from_listing` does,
 * inside the database, from the listing or from an accepted offer. A client can
 * post whatever it likes into `agreed_price_kobo`; the trigger overwrites it.
 *
 * The money, end to end:
 *
 *   checkout         the customer pays the FULL agreed price into Nexa
 *   acceptBooking    the vendor says yes  ->  the deposit share goes to their
 *                      bank, so they can buy materials before the job
 *   confirmWithCode  the customer hands over their one code at the end  ->
 *                      the balance, less commission, goes to the vendor
 *
 * A vendor can never be paid by tapping "done". That is the whole platform.
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
 * Creates the booking, holds the whole price, mints the confirmation code.
 *
 * The row is inserted with the *caller's* client so RLS and the pricing trigger
 * both apply. Everything after the hold runs on the service role, because a
 * customer must not be able to mark their own booking paid.
 *
 * A listing with payment_type 'deposit' is ordinary now, and needs no second
 * collection: the customer still pays 100% up front. "Deposit" describes what
 * the VENDOR receives on acceptance, not what the customer pays at checkout.
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
    .select("id, reference, agreed_price_kobo, commission_percent")
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
    const { checkoutUrl, status } = await holdFunds({
      bookingId: booking.id,
      reference: booking.reference,
      amountKobo: booking.agreed_price_kobo,
      commissionKobo,
      customer,
      redirectUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/orders/${booking.id}`,
    });

    // Only say a booking is paid when it IS paid.
    //
    // A real gateway has, at this point, done nothing but hand the customer a
    // link. Marking the booking paid_held here would be a lie with teeth: the
    // trigger would mint a completion code for money nobody has paid, and the
    // vendor would see a booking to accept — and the deposit release would then
    // fail against an empty escrow. The webhook advances the booking when the
    // charge actually completes. The mock gateway settles inline, so it lands
    // here immediately.
    //
    // The code is minted by a trigger on the paid_held transition: exactly one,
    // stage 2. Nothing mints it earlier, because a booking nobody has paid for
    // has nothing to confirm.
    if (status === "held") {
      await transition(booking.id, "paid_held");
    }

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

/** Moves a booking through the state machine, or refuses to. */
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
 * STAGE 1. The vendor confirms — and that acceptance is itself the checkpoint
 * that releases the deposit.
 *
 * A vendor cannot buy the flowers, hire the extra hands or fuel the generator on
 * a promise. So the moment they commit to the job, their deposit share — the
 * booking's frozen stage_1_release_percent of the provider's gross — leaves
 * Nexa's escrow for their bank account. The customer's free-cancellation window
 * closes at the same instant, which is exactly what makes it safe
 * to send.
 *
 * The release comes before the status write on purpose. If the transfer fails,
 * the booking stays at paid_held, nothing has moved, and the vendor can simply
 * tap accept again. Reading stage_1_released_at first makes that retry safe in
 * the other direction too: a transfer that landed but whose status write did not
 * is not sent twice.
 */
export async function acceptBooking(bookingId: string): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, status, provider_id, agreed_price_kobo, commission_percent, stage_1_release_percent")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new BookingsError("No such booking");
  assertTransition(booking.status, "accepted");

  const { data: payment } = await db
    .from("payments")
    .select("stage_1_released_at")
    .eq("booking_id", bookingId)
    .maybeSingle();

  const { stage1Kobo } = calculatePayout({
    agreedPriceKobo: booking.agreed_price_kobo,
    commissionPercent: booking.commission_percent,
    stage1ReleasePercent: booking.stage_1_release_percent,
    latePenaltyPercentPer30Min: 0,
  });

  if (stage1Kobo > 0 && !payment?.stage_1_released_at) {
    await releaseFunds({
      bookingId,
      stage: 1,
      amountKobo: stage1Kobo,
      beneficiary: await providerBeneficiary(booking.provider_id),
    });
  }

  await transition(bookingId, "accepted");

  await db
    .from("bookings")
    .update({ stage_1_at: new Date().toISOString() })
    .eq("id", bookingId);
}

/**
 * Provider declines. "Customer refunded automatically, no admin needed."
 *. Nothing has been released yet — a rejection can only reach a
 * booking that was never accepted — so the whole price goes back.
 */
export async function rejectBooking(bookingId: string, reason?: string): Promise<void> {
  const db = createAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("agreed_price_kobo")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new BookingsError("No such booking");

  await refund({
    bookingId,
    amountKobo: booking.agreed_price_kobo,
    reason: reason ?? "Provider rejected the booking",
  });

  await transition(bookingId, "rejected");
}

/**
 * The vendor has started the job. A courtesy signal to the customer and nothing
 * more: it moves no money, and the booking can complete without it.
 */
export async function startWork(bookingId: string): Promise<void> {
  await transition(bookingId, "in_progress");
}

/**
 * STAGE 2, and the end of the booking. Always gated on the customer's code —
 * this is the sentence in that the whole platform rests on: money
 * moves "only when a real, verifiable checkpoint has passed", "never on a
 * provider simply tapping 'done' without the required checkpoint."
 *
 * What is released is the balance: the provider's gross less whatever went out
 * as the deposit. Commission never leaves escrow at all — it is Nexa's.
 */
export async function confirmWithCode(bookingId: string, code: string): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, status, provider_id, agreed_price_kobo, commission_percent, stage_1_release_percent")
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
    .update({
      status: "completed",
      stage_2_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq("id", bookingId);
}

/**
 * A code is single-use. Verifying it and marking it consumed has to be one
 * statement, or the same code could be reused.
 */
async function consumeCode(bookingId: string, stage: 2, code?: string): Promise<void> {
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
