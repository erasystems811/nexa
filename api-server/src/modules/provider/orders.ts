import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { acceptBooking, startWork as startBooking, rejectBooking, confirmWithCode, raiseDispute } from "../bookings/index.js";
import { requireProvider, ProviderError } from "./context.js";

/**
 * The vendor's bookings and the actions on them. Ported from apps/customer's
 * modules/provider/orders.ts — unchanged. Vendors own their own fulfillment.
 */

export async function listProviderOrders(supabase: SupabaseClient<Database>, providerId: string) {
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

async function assertOwned(supabase: SupabaseClient<Database>, providerId: string, bookingId: string) {
  const { data } = await supabase
    .from("bookings")
    .select("id, status, fulfillment_type")
    .eq("id", bookingId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (!data) throw new ProviderError("That booking is not yours");
  return data;
}

export async function accept(supabase: SupabaseClient<Database>, providerId: string, bookingId: string): Promise<void> {
  await assertOwned(supabase, providerId, bookingId);
  await acceptBooking(bookingId);
}

export async function reject(supabase: SupabaseClient<Database>, providerId: string, bookingId: string, reason?: string): Promise<void> {
  await assertOwned(supabase, providerId, bookingId);
  await rejectBooking(bookingId, reason);
}

/** The vendor has started the job. Moves no money — it exists so the customer can see work is under way. */
export async function startWork(supabase: SupabaseClient<Database>, providerId: string, bookingId: string): Promise<void> {
  const booking = await assertOwned(supabase, providerId, bookingId);
  if (booking.status !== "accepted") {
    throw new ProviderError("Accept the booking before starting work");
  }
  await startBooking(bookingId);
}

/** The vendor enters the customer's code — proof the job was done, and it pays the vendor then and there. */
export async function enterCompletionCode(
  supabase: SupabaseClient<Database>,
  providerId: string,
  bookingId: string,
  code: string,
): Promise<{ paidKobo: number }> {
  await assertOwned(supabase, providerId, bookingId);
  if (!code.trim()) throw new ProviderError("Enter the code the customer gave you.");
  return confirmWithCode(bookingId, code.trim());
}

/** The customer won't give up the code. The vendor says what happened; Nexa takes it from there. */
export async function reportProblem(
  supabase: SupabaseClient<Database>,
  providerId: string,
  bookingId: string,
  message: string,
): Promise<void> {
  await assertOwned(supabase, providerId, bookingId);
  if (message.trim().length < 10) {
    throw new ProviderError("Tell Nexa what happened — a sentence or two, so we can help.");
  }
  const provider = await requireProvider(supabase);
  await raiseDispute({ bookingId, raisedByUserId: provider.user_id, message: message.trim() });
}
