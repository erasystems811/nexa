import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { currentStaff, adminDashboard } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

/** Admin dashboard. PRD Section 12. */
export default async function AdminDashboard() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const d = await adminDashboard();

  const queues = [
    { label: "Provider applications", value: d.pendingProviders, href: "/providers?status=pending" },
    { label: "Listings to approve", value: d.pendingListings, href: "/listings" },
    { label: "Open disputes", value: d.openDisputes, href: "/disputes" },
    { label: "Flagged messages", value: d.pendingFlags, href: "/moderation" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="The whole marketplace at a glance." />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="In escrow" value={formatKobo(d.heldKobo)} />
        <Stat label="Commission earned" value={formatKobo(d.commissionKobo)} />
        <Stat label="Released to providers" value={formatKobo(d.releasedKobo)} />
        <Stat label="Active providers" value={String(d.providers)} />
        <Stat label="Ongoing orders" value={String(d.ongoingOrders)} />
        <Stat label="Cancelled orders" value={String(d.cancelledOrders)} />
      </section>

      <h2 className="mt-8 mb-3 text-sm font-semibold">Needs attention</h2>
      <ul className="space-y-2">
        {queues.map((q) => (
          <li key={q.label}>
            <Link href={q.href as Route}>
              <Card className="flex items-center justify-between">
                <span className="text-sm">{q.label}</span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${q.value > 0 ? "bg-[color:var(--color-ink)] text-white" : "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-muted)]"}`}
                >
                  {q.value}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {d.providers === 0 ? (
        <Card className="mt-6 text-sm text-[color:var(--color-ink-muted)]">
          No providers yet. Onboard the first one - the marketplace opens the day it has a
          verified provider and the category to match.
        </Card>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-ink-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
