import "server-only";

import { adminDb, audit } from "./context";
import { applyLatePenalty, refund, resolveCautionClaim } from "@/modules/payments";

/**
 * Payment management. PRD Sections 10, 12.
 *
 * The money itself is moved by the payments module (gateway + ledger); this file
 * is the Admin lens over it and the thin authorised wrappers that record who
 * did what. Escrow balances, commission, penalties, and refunds all read from
 * the ledger, which is the single source of truth.
 */

export async function paymentOverview() {
  const db = adminDb();

  const { data: payments } = await db
    .from("payments")
    .select("held_kobo, released_kobo, refunded_kobo, penalty_kobo, commission_kobo, caution_held_kobo, caution_refunded_kobo, caution_claimed_kobo, status");

  const rows = payments ?? [];
  const sum = (f: (p: (typeof rows)[number]) => number) => rows.reduce((a, p) => a + f(p), 0);

  return {
    inEscrow: sum((p) => p.held_kobo - p.released_kobo),
    released: sum((p) => p.released_kobo),
    commission: sum((p) => p.commission_kobo),
    refunded: sum((p) => p.refunded_kobo),
    penalties: sum((p) => p.penalty_kobo),
    cautionHeld: sum((p) => p.caution_held_kobo - p.caution_refunded_kobo - p.caution_claimed_kobo),
    count: rows.length,
  };
}

export async function recentLedger(limit = 100) {
  const db = adminDb();
  const { data } = await db
    .from("payment_ledger_entries")
    .select("id, kind, amount_kobo, stage, note, created_at, booking_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function pendingPayouts() {
  const db = adminDb();
  const { data } = await db
    .from("payouts")
    .select("id, provider_id, rider_id, amount_kobo, status, scheduled_for, created_at")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true });
  return data ?? [];
}

// Authorised wrappers — the money logic lives in @/modules/payments; here we
// only attach the acting admin's name to it.

export async function adminApplyPenalty(actorId: string, bookingId: string, lateMinutes: number) {
  const result = await applyLatePenalty({ bookingId, lateMinutes });
  await audit(actorId, "apply_penalty", "booking", bookingId, null, { lateMinutes, ...result });
  return result;
}

export async function adminRefund(actorId: string, bookingId: string, amountKobo: number, reason: string) {
  await refund({ bookingId, amountKobo, reason });
  await audit(actorId, "refund", "booking", bookingId, null, { amountKobo, reason });
}

export async function adminResolveCautionClaim(actorId: string, bookingId: string, claimKobo: number, disputeId?: string) {
  await resolveCautionClaim({ bookingId, claimKobo });
  if (disputeId) {
    await adminDb().from("disputes").update({ status: "resolved", resolved_by: actorId, resolved_at: new Date().toISOString(), resolution_note: `Caution claim: ${claimKobo} kobo to provider` }).eq("id", disputeId);
  }
  await audit(actorId, "resolve_caution_claim", "booking", bookingId, null, { claimKobo });
}
