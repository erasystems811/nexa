import "server-only";

import { adminDb, audit, AdminError } from "./context";

/** Disputes queue. Includes caution-fee damage claims. */

export async function listDisputes(status?: string) {
  const db = adminDb();
  let q = db
    .from("disputes")
    .select("id, reason, status, created_at, bookings ( reference, providers ( business_name ) )")
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
