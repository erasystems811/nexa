import "server-only";

import { adminDb } from "./context";

/** Dashboard figures. PRD Section 12, updated by Addendum v1.2. */
export async function adminDashboard() {
  const db = adminDb();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.toISOString();

  const head = { count: "exact" as const, head: true };

  const [
    providers,
    pendingProviders,
    pendingListings,
    ongoingOrders,
    todayOrders,
    cancelledOrders,
    openDisputes,
    pendingFlags,
  ] = await Promise.all([
    db.from("providers").select("*", head).eq("status", "approved"),
    db.from("providers").select("*", head).eq("status", "pending"),
    db.from("listings").select("*", head).eq("status", "pending_approval"),
    db.from("bookings").select("*", head).in("status", ["paid_held", "accepted", "in_progress"]),
    db.from("bookings").select("*", head).gte("scheduled_start", today),
    db.from("bookings").select("*", head).eq("status", "cancelled"),
    db.from("disputes").select("*", head).in("status", ["open", "under_review"]),
    db.from("moderation_flags").select("*", head).eq("status", "pending"),
  ]);

  const [{ data: commissionRows }, { data: releaseRows }, { data: escrow }] = await Promise.all([
    db.from("payment_ledger_entries").select("amount_kobo").eq("kind", "commission"),
    db.from("payment_ledger_entries").select("amount_kobo").eq("kind", "stage_release"),
    db
      .from("payments")
      .select("held_kobo, released_kobo, caution_held_kobo, caution_refunded_kobo, caution_claimed_kobo")
      .in("status", ["held", "partially_released"]),
  ]);

  const commissionKobo = (commissionRows ?? []).reduce((a, b) => a + b.amount_kobo, 0);
  const releasedKobo = (releaseRows ?? []).reduce((a, b) => a + b.amount_kobo, 0);
  const heldKobo = (escrow ?? []).reduce(
    (a, p) =>
      a +
      (p.held_kobo - p.released_kobo) +
      (p.caution_held_kobo - p.caution_refunded_kobo - p.caution_claimed_kobo),
    0,
  );

  return {
    providers: providers.count ?? 0,
    pendingProviders: pendingProviders.count ?? 0,
    pendingListings: pendingListings.count ?? 0,
    ongoingOrders: ongoingOrders.count ?? 0,
    todayOrders: todayOrders.count ?? 0,
    cancelledOrders: cancelledOrders.count ?? 0,
    openDisputes: openDisputes.count ?? 0,
    pendingFlags: pendingFlags.count ?? 0,
    commissionKobo,
    releasedKobo,
    heldKobo,
  };
}