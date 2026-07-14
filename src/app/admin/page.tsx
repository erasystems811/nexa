import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { currentStaff, adminDashboard } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

/**
 * The dashboard answers two questions and nothing else: how much of other
 * people's money am I holding, and who is waiting on me?
 */
export default async function AdminDashboard() {
  const staff = await currentStaff();
  if (!staff) redirect("/login");

  const d = await adminDashboard();

  const queues = [
    { label: "Vendors who finished the job and are waiting to be paid", value: d.vendorsToPay, href: "/payments" },
    { label: "Vendors waiting for approval", value: d.vendorsWaiting, href: "/providers?status=pending" },
    { label: "Listings waiting for approval", value: d.listingsWaiting, href: "/listings" },
    { label: "Complaints and flagged messages", value: d.openDisputes + d.pendingFlags, href: "/disputes" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="bg-[color:var(--color-ink)] text-white">
          <p className="text-xs text-white/70">Money Nexa is holding right now</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{formatKobo(d.holdingKobo)}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/70">
            Paid by customers on jobs that are not settled yet. None of it moves until you decide what
            to pay the vendor.
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[color:var(--color-ink-muted)]">Bookings happening today</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{d.bookingsToday}</p>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
            {d.activeVendors} vendor{d.activeVendors === 1 ? "" : "s"} selling on Nexa.
          </p>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold">Waiting on you</h2>
      <ul className="space-y-2">
        {queues.map((q) => (
          <li key={q.label}>
            <Link href={q.href as Route}>
              <Card className="flex items-center justify-between gap-3">
                <span className="text-sm">{q.label}</span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${q.value > 0 ? "bg-[color:var(--color-ink)] text-white" : "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-muted)]"}`}
                >
                  {q.value}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {d.activeVendors === 0 ? (
        <Card className="mt-6 text-sm text-[color:var(--color-ink-muted)]">
          No vendors yet. Add the first one under Vendors — the marketplace opens the day it has a
          vendor and something to sell.
        </Card>
      ) : null}
    </>
  );
}
