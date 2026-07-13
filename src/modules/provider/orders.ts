import "server-only";

import { createClient } from "@/lib/supabase/server";
import { acceptBooking, startWork as startBooking, rejectBooking } from "@/modules/bookings";
import { ProviderError } from "./context";

/**
 * The vendor's bookings and the actions on them. Vendors own their own
 * fulfillment: they turn up and perform the service they listed.
 */

export async function listProviderOrders(providerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start,
       agreed_price_kobo,
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
 * The vendor has started the job. This moves no money — the deposit already
 * went out when they accepted, and the balance waits on the customer's code.
 * It exists so the customer can see that work is under way.
 */
export async function startWork(providerId: string, bookingId: string): Promise<void> {
  const booking = await assertOwned(providerId, bookingId);
  if (booking.status !== "accepted") {
    throw new ProviderError("Accept the booking before starting work");
  }
  await startBooking(bookingId);
}