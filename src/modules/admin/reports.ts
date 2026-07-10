import "server-only";

import { adminDb } from "./context";

/** Reports. PRD Section 12: top providers, most-booked categories, revenue, growth. */

export async function reports() {
  const db = adminDb();

  const [{ data: completed }, { data: providerRatings }, { data: commission }] = await Promise.all([
    db.from("bookings").select("provider_id, listing_id, agreed_price_kobo, created_at, status, listings ( categories ( name ) ), providers ( business_name )").eq("status", "completed"),
    db.from("provider_ratings").select("provider_id, avg_rating, review_count"),
    db.from("payment_ledger_entries").select("amount_kobo, created_at").eq("kind", "commission"),
  ]);

  const rows = completed ?? [];

  // Top providers by completed bookings.
  const byProvider = new Map<string, { name: string; count: number; revenue: number }>();
  for (const b of rows) {
    const name = (b.providers as unknown as { business_name: string } | null)?.business_name ?? "—";
    const cur = byProvider.get(b.provider_id) ?? { name, count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += b.agreed_price_kobo;
    byProvider.set(b.provider_id, cur);
  }
  const topProviders = [...byProvider.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  // Most-booked categories.
  const byCategory = new Map<string, number>();
  for (const b of rows) {
    const name = (b.listings as unknown as { categories: { name: string } | null } | null)?.categories?.name ?? "—";
    byCategory.set(name, (byCategory.get(name) ?? 0) + 1);
  }
  const topCategories = [...byCategory.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  // Commission by month (revenue trend).
  const byMonth = new Map<string, number>();
  for (const c of commission ?? []) {
    const month = c.created_at.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + c.amount_kobo);
  }
  const revenueByMonth = [...byMonth.entries()].map(([month, kobo]) => ({ month, kobo })).sort((a, b) => a.month.localeCompare(b.month));

  void providerRatings;
  return { topProviders, topCategories, revenueByMonth, completedCount: rows.length };
}
