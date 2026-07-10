import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The rider's delivery queue. PRD Section 15.
 *
 * Pickup is the provider; drop-off is the customer. The customer's real address
 * is on the booking; the provider's contact stays masked (a rider is given the
 * pickup location, not a phone number to call around).
 *
 * The confirmation code is deliberately absent from everything here — a rider
 * never sees it. The customer reads it out at the door, and only then does the
 * rider type it into confirmDelivery.
 */
export async function listQueue(riderId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("rider_assignments")
    .select(
      `id, leg, status, fee_share_kobo, assigned_at, picked_up_at, condition_notes,
       bookings (
         id, reference, fulfillment_type, scheduled_start, address, notes,
         listings ( title ),
         providers ( business_name, address )
       )`,
    )
    .eq("rider_id", riderId)
    .not("status", "in", "(declined,cancelled)")
    .order("assigned_at", { ascending: false });

  return data ?? [];
}

export async function getAssignment(riderId: string, assignmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rider_assignments")
    .select(
      `id, leg, status, fee_share_kobo, condition_notes,
       bookings (
         id, reference, fulfillment_type, scheduled_start, address, notes,
         listings ( title ),
         providers ( business_name, address )
       )`,
    )
    .eq("id", assignmentId)
    .eq("rider_id", riderId)
    .maybeSingle();
  return data;
}
