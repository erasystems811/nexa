import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { holdFunds, refund } from "@/modules/payments";
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
 *   acceptBooking    the vendor says yes. Moves NO money.
 *   startWork        the vendor has begun. Moves NO money.
 *   confirmWithCode  the customer hands over their one code — the booking is
 *                      COMPLETE, and still no money has moved
 *   (later)          an ADMIN releases what the vendor has earned, in full or in
 *                      part, from the Admin Console
 *
 * Nothing in this file can pay a vendor. That is deliberate: the code proves the
 * job was done, and a human decides what leaves escrow. rejectBooking is the one
 * exception, and it only sends money BACK to the customer.
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
    })
    .select("id, reference, agreed_price_kobo")
    .single();

  if (bookingError || !booking) {
    throw new BookingsError(bookingError?.message ?? "Could not create the booking");
  }

  try {
    const { checkoutUrl, status } = await holdFunds({
      bookingId: booking.id,
      reference: booking.reference,
      // The whole price. Nexa holds all of it, and works out nobody's cut.
      amountKobo: booking.agreed_price_kobo,
      customer,
      redirectUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/orders/${booking.id}`,
    });

    // Only say a booking is paid when it IS paid.
    //
    // A real gateway has, at this point, done nothing but hand the customer a
    // link. Marking the booking paid_held here would be a lie with teeth: the
    // trigger would mint a completion code for money nobody has paid, and the
    // vendor would see a booking to accept. The webhook advances the booking when
    // the charge actually completes. The mock gateway settles inline, so it lands
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
 * The vendor confirms they will do the job.
 *
 * It moves NO money. Nexa holds everything the customer paid until the job is
 * done and an admin releases it — an acceptance is a promise, not a delivery, and
 * nothing about it says what a vendor has earned. The customer's
 * free-cancellation window closes here; that is all that changes.
 */
export async function acceptBooking(bookingId: string): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new BookingsError("No such booking");
  assertTransition(booking.status, "accepted");

  await transition(bookingId, "accepted");
}

/**
 * Provider declines. The customer is refunded automatically, with no admin in the
 * loop: nothing has ever been released — a rejection can only reach a booking
 * that was never accepted — so the whole price goes straight back.
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
 * The end of the booking, and the proof that the job was done: the customer's
 * ONE confirmation code, handed to the vendor and entered here. A vendor can
 * never complete a booking by tapping "done".
 *
 * It moves no money. The code is evidence, not a payment instruction — an admin
 * reads it as "this job happened" and then decides, in the Admin Console, how
 * much of what Nexa is holding the vendor is paid. Keeping the two apart is what
 * lets a dispute be settled before the money is gone.
 */
export async function confirmWithCode(bookingId: string, code: string): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (!booking) throw new BookingsError("No such booking");
  assertTransition(booking.status, "completed");

  await consumeCode(bookingId, 2, code);

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
