import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";

/**
 * Admin dashboard. PRD Section 12 specifies provider counts, pending
 * applications, listing approvals, today's orders, revenue. Those queries land
 * with their modules; the shell and the counts that exist today are here.
 */
export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: categoryCount }, { count: cityCount }] = await Promise.all([
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase.from("cities").select("*", { count: "exact", head: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Provider verification, listing approvals, orders, and disputes arrive with their modules."
      />

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">
            Categories
          </p>
          <p className="mt-2 text-3xl font-semibold">{categoryCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">
            Cities
          </p>
          <p className="mt-2 text-3xl font-semibold">{cityCount ?? 0}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Before the marketplace can open</h2>
        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
          There are no seeded categories, cities, or providers, by design. Create
          the first city, then the first category, on the day the first verified
          provider is onboarded.
        </p>
        <Link href="/admin/settings" className="mt-3 inline-block text-sm underline">
          Review platform settings and feature flags →
        </Link>
      </Card>
    </>
  );
}
