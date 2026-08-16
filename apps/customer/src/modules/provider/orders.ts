import "server-only";

import { createClient } from "@/lib/supabase/server";
import { acceptBooking, startWork as startBooking, rejectBooking, confirmWithCode, raiseDispute } from "@/modules/bookings";
import { requireProvider } from "./context";
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
       agreed_price_kobo, accepted_at,
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
 * The vendor has started the job. This moves no money — Nexa is holding the
 * whole amount and pays the vendor once the job is done. It exists so the
 * customer can see that work is under way.
 */
export async function startWork(providerId: string, bookingId: string): Promise<void> {
  const booking = await assertOwned(providerId, bookingId);
  if (booking.status !== "accepted") {
    throw new ProviderError("Accept the booking before starting work");
  }
  await startBooking(bookingId);
}

/**
 * The vendor enters the code the customer gave them. It is proof the job was
 * done — and entering it pays the vendor, then and there: everything Nexa is
 * holding, less Nexa's commission. There is no admin step on the happy path.
 */
export async function enterCompletionCode(
  providerId: string,
  bookingId: string,
  code: string,
): Promise<{ paidKobo: number }> {
  await assertOwned(providerId, bookingId);
  if (!code.trim()) throw new ProviderError("Enter the code the customer gave you.");
  return confirmWithCode(bookingId, code.trim());
}

/**
 * The customer will not give up the code. The vendor says what happened and
 * points to their proof; Nexa takes it from there.
 */
export async function reportProblem(
  providerId: string,
  bookingId: string,
  message: string,
): Promise<void> {
  await assertOwned(providerId, bookingId);
  if (message.trim().length < 10) {
    throw new ProviderError("Tell Nexa what happened — a sentence or two, so we can help.");
  }
  const provider = await requireProvider();
  await raiseDispute({ bookingId, raisedByUserId: provider.user_id, message: message.trim() });
}
