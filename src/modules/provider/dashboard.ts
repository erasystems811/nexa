import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard figures. PRD Section 13: today's and upcoming bookings, revenue,
 * rating, reviews.
 *
 * Revenue is read from the wallet's completed earnings, not summed from
 * bookings — the wallet is what the payments module actually settled, and a
 * booking's price is not money until a stage releases.
 */
export async function providerDashboard(providerId: string) {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [bookings, wallet, rating, pendingListings] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, status, scheduled_start, agreed_price_kobo")
      .order("scheduled_start", { ascending: true }),
    supabase
      .from("provider_wallets")
      .select("pending_kobo, available_kobo, withdrawn_kobo")
      .eq("provider_id", providerId)
      .maybeSingle(),
    supabase
      .from("provider_ratings")
      .select("avg_rating, review_count")
      .eq("provider_id", providerId)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .eq("status", "pending_approval"),
  ]);

  const rows = bookings.data ?? [];
  const active = rows.filter((b) =>
    ["paid_held", "accepted", "in_progress"].includes(b.status),
  );

  return {
    todayCount: active.filter(
      (b) =>
        new Date(b.scheduled_start) >= startOfToday &&
        new Date(b.scheduled_start) < endOfToday,
    ).length,
    upcomingCount: active.filter((b) => new Date(b.scheduled_start) >= endOfToday)
      .length,
    awaitingResponse: rows.filter((b) => b.status === "paid_held").length,
    pendingListings: pendingListings.count ?? 0,
    wallet: wallet.data ?? { pending_kobo: 0, available_kobo: 0, withdrawn_kobo: 0 },
    rating: rating.data ?? null,
  };
}
