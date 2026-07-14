import "server-only";

import { adminDb } from "./context";

/**
 * The four things a person running Nexa needs to know when they open the
 * console: who is waiting on them, and how much of other people's money they are
 * holding. Nothing else. No vanity totals.
 */
export async function adminDashboard() {
  const db = adminDb();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const head = { count: "exact" as const, head: true };

  const [vendorsWaiting, listingsWaiting, bookingsToday, openDisputes, pendingFlags, activeVendors] =
    await Promise.all([
      db.from("providers").select("*", head).eq("status", "pending"),
      db.from("listings").select("*", head).eq("status", "pending_approval"),
      db
        .from("bookings")
        .select("*", head)
        .gte("scheduled_start", startOfToday.toISOString())
        .lt("scheduled_start", endOfToday.toISOString()),
      db.from("disputes").select("*", head).in("status", ["open", "under_review"]),
      db.from("moderation_flags").select("*", head).eq("status", "pending"),
      db.from("providers").select("*", head).eq("status", "approved"),
    ]);

  // Money Nexa is holding, and the vendors waiting for it. A completed booking
  // with money still held is a vendor who has done the work and not been paid —
  // the single most important number on this screen.
  const { data: payments } = await db
    .from("payments")
    .select("held_kobo, released_kobo, refunded_kobo, bookings ( status )")
    .in("status", ["held", "partially_released"]);

  let holdingKobo = 0;
  let vendorsToPay = 0;

  for (const p of payments ?? []) {
    const left = Math.max(0, p.held_kobo - p.released_kobo - p.refunded_kobo);
    if (left <= 0) continue;
    holdingKobo += left;
    if ((p.bookings as unknown as { status: string } | null)?.status === "completed") vendorsToPay += 1;
  }

  return {
    vendorsWaiting: vendorsWaiting.count ?? 0,
    listingsWaiting: listingsWaiting.count ?? 0,
    bookingsToday: bookingsToday.count ?? 0,
    openDisputes: openDisputes.count ?? 0,
    pendingFlags: pendingFlags.count ?? 0,
    activeVendors: activeVendors.count ?? 0,
    holdingKobo,
    vendorsToPay,
  };
}
