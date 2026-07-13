import "server-only";

import { createClient } from "@/lib/supabase/server";

/** My Events. RLS restricts these to the caller's own bookings. */
export async function listMyOrders() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start,
       agreed_price_kobo, created_at,
       listings ( title, slug ),
       providers ( business_name, slug )`,
    )
    .order("scheduled_start", { ascending: false });

  return data ?? [];
}

/**
 * One booking, with the customer's completion code.
 *
 * The code comes back only because the caller is the customer:
 * `booking_codes_customer_only` has no policy for anyone else. It belongs to the
 * person who owns it, and it is the only thing that releases the balance.
 */
export async function getMyOrder(bookingId: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start, scheduled_end,
       address, notes, agreed_price_kobo,
       stage_1_release_percent, commission_percent, stage_1_at, stage_2_at,
       created_at, accepted_at, completed_at,
       listings ( title, slug ),
       providers ( id, business_name, slug )`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return null;

  const { data: codes } = await supabase
    .from("booking_confirmation_codes")
    .select("stage, code, consumed_at")
    .eq("booking_id", bookingId)
    .order("stage");

  return { booking, codes: codes ?? [] };
}
