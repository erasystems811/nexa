import "server-only";

import { createClient } from "@/lib/supabase/server";
import { acceptBooking, recordStage1, rejectBooking } from "@/modules/bookings";
import { ProviderError } from "./context";

/**
 * The provider's orders and the actions on them. Addendum v1.2 removes the
 * Nexa-operated rider pool: vendors own ordinary fulfillment for their listings.
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
 * Goods and services are fulfilled by the provider under Addendum v1.2. This
 * marks provider-owned fulfillment as started without booking a Nexa rider.
 */
export async function startFulfillment(providerId: string, bookingId: string): Promise<void> {
  const booking = await assertOwned(providerId, bookingId);
  if (booking.status !== "accepted") {
    throw new ProviderError("Accept the booking before starting fulfillment");
  }
  await recordStage1(bookingId);
}

/** Service providers check in on arrival. */
export async function checkIn(providerId: string, bookingId: string): Promise<void> {
  const booking = await assertOwned(providerId, bookingId);
  if (booking.status !== "accepted") {
    throw new ProviderError("Accept the booking before checking in");
  }
  await recordStage1(bookingId);
}