import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ProviderError } from "./context";

/**
 * Availability calendar.: Available / Booked / Unavailable.
 *
 * "Booked" is not stored here — it is derived from live bookings, so the two
 * cannot disagree. This table records only the provider's manual "Unavailable"
 * blocks, which is what `reject_double_booking` consults at checkout.
 */

export async function listAvailability(listingId: string) {
  const supabase = await createClient();
  const [{ data: blocks }, { data: booked }] = await Promise.all([
    supabase
      .from("listing_availability")
      .select("id, starts_at, ends_at, is_available, note")
      .eq("listing_id", listingId)
      .order("starts_at"),
    supabase
      .from("bookings")
      .select("scheduled_start, scheduled_end, status")
      .eq("listing_id", listingId)
      .in("status", ["paid_held", "accepted", "in_progress"]),
  ]);

  return { blocks: blocks ?? [], booked: booked ?? [] };
}

export async function blockUnavailable(input: {
  listingId: string;
  startsAt: string;
  endsAt: string;
  note?: string;
}): Promise<void> {
  if (new Date(input.startsAt) >= new Date(input.endsAt)) {
    throw new ProviderError("The end must be after the start");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("listing_availability").insert({
    listing_id: input.listingId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_available: false,
    note: input.note ?? null,
  });

  if (error) throw new ProviderError(error.message);
}

export async function removeBlock(blockId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("listing_availability").delete().eq("id", blockId);
  if (error) throw new ProviderError(error.message);
}
