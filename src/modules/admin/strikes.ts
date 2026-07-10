import "server-only";

import { adminDb, audit, AdminError } from "./context";
import { refund } from "@/modules/payments";

/**
 * Suspension, appeals, and strikes. PRD Section 05.
 *
 * The consequence chain the founder specified, exactly:
 *   no-show            -> automatic suspension pending appeal + booking refunded
 *   appeal upheld      -> suspension lifted, no strike
 *   appeal failed      -> a strike is recorded
 *   permanent removal  -> a manual Admin decision with the full history in view,
 *                         never an automatic threshold.
 *
 * There is deliberately no "strikes >= N -> removed" rule anywhere.
 */

/**
 * Records a no-show against a provider on a booking: suspends them pending
 * appeal, and cancels + refunds the booking (Section 10 no-show consequence).
 */
export async function recordNoShow(actorId: string, bookingId: string): Promise<void> {
  const db = adminDb();

  const { data: booking } = await db
    .from("bookings")
    .select("id, provider_id, status, agreed_price_kobo, delivery_fee_kobo, caution_fee_kobo")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new AdminError("No such booking");

  // A pending strike is opened (open until an appeal resolves it).
  const { error: strikeErr } = await db.from("provider_strikes").insert({
    provider_id: booking.provider_id,
    booking_id: bookingId,
    reason: "no_show",
    notes: "Automatic suspension pending appeal",
    issued_by: actorId,
  });
  if (strikeErr) throw new AdminError(strikeErr.message);

  await db.from("providers").update({ status: "suspended" }).eq("id", booking.provider_id);

  if (!["cancelled", "rejected", "completed"].includes(booking.status)) {
    await refund({
      bookingId,
      amountKobo: booking.agreed_price_kobo + booking.delivery_fee_kobo + booking.caution_fee_kobo,
      reason: "Provider no-show",
    });
    await db.from("bookings").update({ status: "cancelled", cancellation_reason: "Provider no-show" }).eq("id", bookingId);
  }

  await audit(actorId, "record_no_show", "provider", booking.provider_id, null, { bookingId });
}

export async function listStrikes(providerId: string) {
  const db = adminDb();
  const { data } = await db
    .from("provider_strikes")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Resolves an appeal on an open strike. Upheld lifts the suspension and voids
 * the strike; failed keeps the strike on the record and leaves the appeal
 * outcome for a removal decision later.
 */
export async function resolveAppeal(
  actorId: string,
  strikeId: string,
  upheld: boolean,
): Promise<void> {
  const db = adminDb();

  const { data: strike } = await db.from("provider_strikes").select("*").eq("id", strikeId).single();
  if (!strike) throw new AdminError("No such strike");

  await db
    .from("provider_strikes")
    .update({ appealed_at: new Date().toISOString(), appeal_upheld: upheld })
    .eq("id", strikeId);

  if (upheld) {
    // Suspension lifted; the strike is voided by the upheld appeal.
    await db.from("providers").update({ status: "approved" }).eq("id", strike.provider_id);
  } else {
    // The strike stands and is counted.
    const { data: provider } = await db.from("providers").select("strike_count").eq("id", strike.provider_id).single();
    await db.from("providers").update({ strike_count: (provider?.strike_count ?? 0) + 1 }).eq("id", strike.provider_id);
  }

  await audit(actorId, upheld ? "appeal_upheld" : "appeal_failed", "provider_strike", strikeId, null, { upheld });
}

/**
 * Permanent removal — a manual decision (Section 05). Sets the provider to
 * 'removed', which hides their listings and reverts their role.
 */
export async function removeProvider(actorId: string, providerId: string, reason: string): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("providers")
    .update({ status: "removed", rejection_reason: reason })
    .eq("id", providerId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "remove_provider", "provider", providerId, null, { reason });
}
