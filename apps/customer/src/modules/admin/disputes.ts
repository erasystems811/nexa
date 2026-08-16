import "server-only";

import { adminDb, audit, AdminError } from "./context";
import { settleVendorPayout, refund } from "@/modules/payments";

/** Disputes queue. Includes caution-fee damage claims. */

export async function listDisputes(status?: string) {
  const db = adminDb();
  let q = db
    .from("disputes")
    .select("id, reason, description, status, created_at, bookings ( id, reference, providers ( business_name ), profiles ( full_name, phone ) )")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status as never);
  else q = q.in("status", ["open", "under_review"]);
  const { data } = await q;
  return data ?? [];
}

export async function getDisputeDetail(disputeId: string) {
  const db = adminDb();
  const { data: dispute } = await db
    .from("disputes")
    .select("*, bookings ( id, reference, agreed_price_kobo, provider_id, customer_id )")
    .eq("id", disputeId)
    .maybeSingle();
  if (!dispute) return null;

  const bookingId = (dispute.bookings as unknown as { id: string } | null)?.id;
  const [evidence, payment] = await Promise.all([
    db.from("dispute_evidence").select("*").eq("dispute_id", disputeId),
    bookingId ? db.from("payments").select("*").eq("booking_id", bookingId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { dispute, evidence: evidence.data ?? [], payment: payment.data };
}

export async function resolveDispute(
  actorId: string,
  disputeId: string,
  outcome: "resolved" | "rejected",
  note: string,
): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("disputes")
    .update({ status: outcome, resolution_note: note, resolved_by: actorId, resolved_at: new Date().toISOString() })
    .eq("id", disputeId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, `dispute_${outcome}`, "dispute", disputeId, null, { note });
}


/**
 * The fallback the founder asked for: the customer will not hand over the code,
 * the vendor showed they did the job, and Nexa pays the vendor without a code.
 *
 * Pays what a completed booking earns — everything held, less commission — then
 * completes the booking and closes the dispute. Same money maths as the happy
 * path; only the trigger is a human instead of a code.
 */
export async function payVendorAndResolve(actorId: string, disputeId: string, note: string): Promise<void> {
  const db = adminDb();
  const { data: dispute } = await db
    .from("disputes")
    .select("booking_id, status")
    .eq("id", disputeId)
    .maybeSingle();
  if (!dispute) throw new AdminError("No such dispute.");

  const paid = await settleVendorPayout(dispute.booking_id);

  await db
    .from("bookings")
    .update({ status: "completed", completed_at: new Date().toISOString(), stage_2_at: new Date().toISOString() })
    .eq("id", dispute.booking_id);

  await db
    .from("disputes")
    .update({ status: "resolved", resolution_note: note || "Paid the vendor without a code.", resolved_by: actorId, resolved_at: new Date().toISOString() })
    .eq("id", disputeId);

  await audit(actorId, "dispute_paid_vendor", "dispute", disputeId, null, { paidKobo: paid });
}

/**
 * The other way it can go: the customer was right, the job was not done. Refund
 * everything Nexa is still holding, cancel the booking, close the dispute.
 */
export async function refundCustomerAndResolve(actorId: string, disputeId: string, note: string): Promise<void> {
  const db = adminDb();
  const { data: dispute } = await db
    .from("disputes")
    .select("booking_id")
    .eq("id", disputeId)
    .maybeSingle();
  if (!dispute) throw new AdminError("No such dispute.");

  const { data: payment } = await db
    .from("payments")
    .select("held_kobo, released_kobo, refunded_kobo")
    .eq("booking_id", dispute.booking_id)
    .maybeSingle();
  const stillHeld = payment ? payment.held_kobo - payment.released_kobo - (payment.refunded_kobo ?? 0) : 0;

  if (stillHeld > 0) {
    await refund({ bookingId: dispute.booking_id, amountKobo: stillHeld, reason: note || "Dispute resolved in the customer's favour." });
  }

  await db.from("bookings").update({ status: "cancelled", cancellation_reason: note || "Dispute refunded." }).eq("id", dispute.booking_id);
  await db
    .from("disputes")
    .update({ status: "resolved", resolution_note: note || "Refunded the customer.", resolved_by: actorId, resolved_at: new Date().toISOString() })
    .eq("id", disputeId);

  await audit(actorId, "dispute_refunded_customer", "dispute", disputeId, null, { refundedKobo: stillHeld });
}
