import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** My Events. RLS restricts these to the caller's own bookings. */
export async function listMyOrders() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start,
       agreed_price_kobo, created_at,
       listings ( title, slug ),
       providers ( business_name, slug ),
       booking_confirmation_codes ( stage, code, consumed_at )`,
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
       address, notes, agreed_price_kobo, stage_2_at,
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

/**
 * Same shape as getMyOrder, for the token-gated /track/[id] page a WhatsApp-
 * only customer uses instead - there is no session for RLS to check, so the
 * caller (the page) must have already verified the booking's access token
 * before ever calling this.
 */
export async function getOrderAsAdmin(bookingId: string) {
  const admin = createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select(
      `id, reference, status, fulfillment_type, scheduled_start, scheduled_end,
       address, notes, agreed_price_kobo, stage_2_at,
       created_at, accepted_at, completed_at,
       listings ( title, slug ),
       providers ( id, business_name, slug )`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return null;

  const { data: codes } = await admin
    .from("booking_confirmation_codes")
    .select("stage, code, consumed_at")
    .eq("booking_id", bookingId)
    .order("stage");

  return { booking, codes: codes ?? [] };
}
