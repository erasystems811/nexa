import "server-only";

import { createClient } from "@/lib/supabase/server";

/** My Orders. PRD Section 14. RLS restricts these to the caller's own bookings. */
export async function listMyOrders() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start,
       agreed_price_kobo, delivery_fee_kobo, caution_fee_kobo, created_at,
       listings ( title, slug ),
       providers ( business_name, slug )`,
    )
    .order("scheduled_start", { ascending: false });

  return data ?? [];
}

/**
 * One order, with its confirmation codes.
 *
 * The codes come back only because the caller is the customer:
 * `booking_codes_customer_only` (0011) has no policy for providers or riders.
 * Section 14 wants them "front and centre" — for the person who owns them.
 */
export async function getMyOrder(bookingId: string) {
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start, scheduled_end,
       address, notes, agreed_price_kobo, delivery_fee_kobo, caution_fee_kobo,
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
