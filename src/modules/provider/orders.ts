import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  acceptBooking,
  markReadyForPickup,
  recordStage1,
  rejectBooking,
} from "@/modules/bookings";
import { ProviderError } from "./context";

/**
 * The provider's orders and the actions on them. PRD Section 13.
 *
 * The booking-service functions (acceptBooking, recordStage1, …) take a booking
 * id and trust the caller to have authorised it — they run on the service role.
 * So authorisation happens HERE: every action first confirms the booking
 * belongs to this provider, using the provider's own RLS-scoped client. A
 * booking that is not theirs is simply not returned, and the action refuses.
 */

export async function listProviderOrders(providerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start,
       agreed_price_kobo, delivery_fee_kobo, ready_for_pickup_at,
       stage_1_at, accepted_at,
       listings ( title )`,
    )
    .eq("provider_id", providerId)
    .order("scheduled_start", { ascending: false });
  return data ?? [];
}

/** Confirms this booking is this provider's, or throws. The authz gate. */
async function assertOwned(providerId: string, bookingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, status, fulfillment_type")
    .eq("id", bookingId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (!data) throw new ProviderError("That booking is not yours");
  return data;
}

export async function accept(providerId: string, bookingId: string): Promise<void> {
  await assertOwned(providerId, bookingId);
  await acceptBooking(bookingId);
}

export async function reject(
  providerId: string,
  bookingId: string,
  reason?: string,
): Promise<void> {
  await assertOwned(providerId, bookingId);
  await rejectBooking(bookingId, reason);
}

/**
 * Physical goods: mark ready for a rider. PRD Section 13 — this is all the
 * provider does; they never arrange delivery.
 */
export async function markReady(providerId: string, bookingId: string): Promise<void> {
  const booking = await assertOwned(providerId, bookingId);
  if (!["delivery", "delivery_return"].includes(booking.fulfillment_type)) {
    throw new ProviderError("Only physical-goods bookings have a pickup");
  }
  await markReadyForPickup(bookingId);
}

/**
 * Service: check in on arrival. PRD Section 13. For an on-site or
 * vendor-location booking this IS the stage-1 checkpoint (Section 10), so it
 * releases the stage-1 payment — the provider showing up is the verifiable event.
 */
export async function checkIn(providerId: string, bookingId: string): Promise<void> {
  const booking = await assertOwned(providerId, bookingId);
  if (["delivery", "delivery_return"].includes(booking.fulfillment_type)) {
    throw new ProviderError("A goods booking is picked up by a rider, not checked in");
  }
  await recordStage1(bookingId);
}
