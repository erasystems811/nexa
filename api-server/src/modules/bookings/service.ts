import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStatus, Database } from "@nexa/db-types/src/types";
import { createAdminClient } from "../../supabase.js";
import { holdFunds, refund, settleVendorPayout, vendorCanBePaid } from "../payments/index.js";
import { notifyVendorOfNewBooking } from "../messaging/whatsapp.js";
import { env } from "../../env.js";
import { assertTransition } from "./state.js";

export class BookingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingsError";
  }
}

/**
 * The booking engine. Ported from apps/customer's modules/bookings/service.ts
 * — identical logic. Never calls a payment processor directly, only
 * ../payments (ESLint-enforced). Never decides a price — the DB trigger
 * price_booking_from_listing does.
 *
 * The money, end to end: checkout holds the full price; acceptBooking and
 * startWork move no money; confirmWithCode completes the booking and pays
 * the vendor immediately (everything held, less commission); an ADMIN can
 * later release more or refund, from the Admin app.
 */

export interface CheckoutInput {
  listingId: string;
  scheduledStart: string;
  scheduledEnd?: string | null;
  address?: string;
  notes?: string;
  /** Where the gateway sends the customer back to. Defaults to CUSTOMER_APP_URL/orders/:id. */
  buildRedirectUrl?: (bookingId: string) => string;
}

export interface CheckoutResult {
  bookingId: string;
  reference: string;
  checkoutUrl?: string;
}

/** Creates the booking, holds the whole price, mints the confirmation code. Runs on the caller's own client so RLS and the pricing trigger apply. */
export async function checkout(
  supabase: SupabaseClient<Database>,
  input: CheckoutInput,
  customer: { id: string; email: string; name?: string },
): Promise<CheckoutResult> {
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
      amountKobo: booking.agreed_price_kobo,
      customer,
      redirectUrl: input.buildRedirectUrl
        ? input.buildRedirectUrl(booking.id)
        : `${env.CUSTOMER_APP_URL}/orders/${booking.id}`,
    });

    // Only say a booking is paid when it IS paid — the code is minted by a
    // trigger on the paid_held transition, and a real gateway has at this
    // point only handed the customer a link. The mock gateway settles
    // inline, so it lands here immediately.
    if (status === "held") {
      await transition(booking.id, "paid_held");
    }

    return { bookingId: booking.id, reference: booking.reference, checkoutUrl };
  } catch (error) {
    await createAdminClient()
      .from("bookings")
      .update({ status: "cancelled", cancellation_reason: "Payment failed" })
      .eq("id", booking.id);

    throw new BookingsError(error instanceof Error ? error.message : "Payment could not be completed");
  }
}

/** Pay for a booking that was created but never paid — the "Not finished" case. */
export async function resumePayment(
  supabase: SupabaseClient<Database>,
  bookingId: string,
  customer: { id: string; email: string; name?: string },
): Promise<CheckoutResult> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, reference, status, agreed_price_kobo")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) throw new BookingsError("That booking does not exist");
  if (booking.status !== "pending") {
    throw new BookingsError("This booking has already been paid for or closed.");
  }

  const { checkoutUrl, status } = await holdFunds({
    bookingId: booking.id,
    reference: booking.reference,
    amountKobo: booking.agreed_price_kobo,
    customer,
    redirectUrl: `${env.CUSTOMER_APP_URL}/orders/${booking.id}`,
  });

  if (status === "held") {
    await transition(booking.id, "paid_held");
  }

  return { bookingId: booking.id, reference: booking.reference, checkoutUrl };
}

/** Moves a booking through the state machine, or refuses to. */
async function transition(bookingId: string, to: BookingStatus) {
  const db = createAdminClient();

  const { data: current } = await db.from("bookings").select("status").eq("id", bookingId).single();

  if (!current) throw new BookingsError("No such booking");
  assertTransition(current.status, to);

  const now = new Date().toISOString();
  const stamps: Record<string, string> = {};
  if (to === "accepted") stamps.accepted_at = now;
  if (to === "rejected") stamps.rejected_at = now;
  if (to === "cancelled") stamps.cancelled_at = now;
  if (to === "completed") stamps.completed_at = now;

  const { error } = await db.from("bookings").update({ status: to, ...stamps }).eq("id", bookingId);

  if (error) throw new BookingsError(`Could not update the booking: ${error.message}`);

  if (to === "paid_held") {
    try {
      await notifyVendorOfNewBooking(bookingId);
    } catch {
      // Best-effort: the booking itself is already correctly paid and held.
    }
  }
}

/** The vendor confirms they will do the job. Moves NO money. */
export async function acceptBooking(bookingId: string): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db.from("bookings").select("id, status").eq("id", bookingId).single();

  if (!booking) throw new BookingsError("No such booking");
  assertTransition(booking.status, "accepted");

  await transition(bookingId, "accepted");
}

/** Provider declines. The customer is refunded automatically — nothing has ever been released. */
export async function rejectBooking(bookingId: string, reason?: string): Promise<void> {
  const db = createAdminClient();
  const { data: booking } = await db.from("bookings").select("agreed_price_kobo").eq("id", bookingId).single();

  if (!booking) throw new BookingsError("No such booking");

  await refund({
    bookingId,
    amountKobo: booking.agreed_price_kobo,
    reason: reason ?? "Provider rejected the booking",
  });

  await transition(bookingId, "rejected");
}

/** The customer's own free cancellation — only before the vendor has accepted. */
export async function cancelBookingByCustomer(bookingId: string): Promise<void> {
  const db = createAdminClient();
  const { data: booking } = await db.from("bookings").select("status, agreed_price_kobo").eq("id", bookingId).single();

  if (!booking) throw new BookingsError("No such booking");

  if (booking.status !== "paid_held") {
    throw new BookingsError(
      booking.status === "pending"
        ? "This booking hasn't been paid for yet, so there's nothing to refund."
        : "This booking has already been accepted and can no longer be cancelled this way.",
    );
  }

  await refund({
    bookingId,
    amountKobo: booking.agreed_price_kobo,
    reason: "Customer cancelled before the vendor accepted",
  });

  await transition(bookingId, "cancelled");
}

/** The vendor has started the job. A courtesy signal — moves no money. */
export async function startWork(bookingId: string): Promise<void> {
  await transition(bookingId, "in_progress");
}

/**
 * The end of the booking: the customer's ONE confirmation code, entered by
 * the vendor. A vendor can never complete a booking by tapping "done". Moves
 * no money by itself — the vendor is paid via settleVendorPayout right after.
 */
export async function confirmWithCode(bookingId: string, code: string): Promise<{ paidKobo: number }> {
  const db = createAdminClient();

  const { data: booking } = await db.from("bookings").select("id, status").eq("id", bookingId).single();

  if (!booking) throw new BookingsError("No such booking");
  assertTransition(booking.status, "completed");

  // Check there is somewhere to pay BEFORE consuming the single-use code.
  if (!(await vendorCanBePaid(bookingId))) {
    throw new BookingsError("Add your bank account in Business Studio first, so Nexa knows where to send your money.");
  }

  await consumeCode(bookingId, 2, code);

  await db
    .from("bookings")
    .update({
      status: "completed",
      stage_2_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  const paidKobo = await settleVendorPayout(bookingId);
  return { paidKobo };
}

/** The vendor says the customer won't hand over the code; Nexa steps in and an admin decides. */
export async function raiseDispute(input: { bookingId: string; raisedByUserId: string; message: string }): Promise<void> {
  const db = createAdminClient();

  const { data: booking } = await db.from("bookings").select("status").eq("id", input.bookingId).single();
  if (!booking) throw new BookingsError("No such booking");

  if (["rejected", "cancelled", "completed"].includes(booking.status)) {
    throw new BookingsError("This booking is already settled and cannot be disputed.");
  }

  const { error: disputeError } = await db.from("disputes").insert({
    booking_id: input.bookingId,
    raised_by: input.raisedByUserId,
    reason: "vendor_no_code",
    description: input.message,
    status: "open",
  });
  if (disputeError) throw new BookingsError(`Could not raise the dispute: ${disputeError.message}`);

  if (booking.status !== "disputed") {
    await transition(input.bookingId, "disputed");
  }
}

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
