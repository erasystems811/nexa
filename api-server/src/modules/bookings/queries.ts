import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { createAdminClient } from "../../supabase.js";

/** My Events. Ported from apps/customer's modules/bookings/queries.ts — unchanged. RLS restricts these to the caller's own bookings. */
export async function listMyOrders(supabase: SupabaseClient<Database>) {
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

/** One booking, with the customer's completion code — comes back only because the caller is the customer (RLS). */
export async function getMyOrder(supabase: SupabaseClient<Database>, bookingId: string) {
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

/** Sets a password on the booking's own customer account — call only after verifying the booking's access token (the /track flow's proof of identity). */
export async function setPasswordForBookingCustomer(
  bookingId: string,
  password: string,
): Promise<{ phone: string | null } | null> {
  const admin = createAdminClient();

  const { data: booking } = await admin.from("bookings").select("customer_id").eq("id", bookingId).maybeSingle();
  if (!booking) return null;

  const { data: profile } = await admin.from("profiles").select("phone").eq("id", booking.customer_id).maybeSingle();

  const { error } = await admin.auth.admin.updateUserById(booking.customer_id, { password });
  if (error) throw new Error("Could not set a password");

  return { phone: profile?.phone ?? null };
}

/** Same shape as getMyOrder, for the token-gated /track/:id flow — the caller must already have verified the booking's access token. */
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
