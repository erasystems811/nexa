import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { ProviderError } from "./context.js";

/** Availability calendar. Ported from apps/customer's modules/provider/availability.ts — unchanged. "Booked" is derived from live bookings, never stored here. */

export async function listAvailability(supabase: SupabaseClient<Database>, listingId: string) {
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

export async function blockUnavailable(
  supabase: SupabaseClient<Database>,
  input: { listingId: string; startsAt: string; endsAt: string; note?: string },
): Promise<void> {
  if (new Date(input.startsAt) >= new Date(input.endsAt)) {
    throw new ProviderError("The end must be after the start");
  }

  const { error } = await supabase.from("listing_availability").insert({
    listing_id: input.listingId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_available: false,
    note: input.note ?? null,
  });

  if (error) throw new ProviderError(error.message);
}

export async function removeBlock(supabase: SupabaseClient<Database>, blockId: string): Promise<void> {
  const { error } = await supabase.from("listing_availability").delete().eq("id", blockId);
  if (error) throw new ProviderError(error.message);
}
