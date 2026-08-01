import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { Wallet, CalendarCheck } from "lucide-react";
import { currentStaff, adminDashboard } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";

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
      <h1 className="font-serif text-2xl font-bold">Dashboard</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card className="bg-zinc-900 text-zinc-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Money Nexa is holding right now</p>
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
                <Wallet className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{formatKobo(d.holdingKobo)}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Paid by customers on jobs that are not settled yet. None of it moves until you decide what to pay
              the vendor.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 text-zinc-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Bookings happening today</p>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
                <CalendarCheck className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{d.bookingsToday}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              {d.activeVendors} vendor{d.activeVendors === 1 ? "" : "s"} selling on Nexa.
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-serif text-lg font-semibold">Waiting on you</h2>
      <ul className="space-y-2">
        {queues.map((q) => (
          <li key={q.label}>
            <Link href={q.href as Route}>
              <Card className={q.value > 0 ? "border-l-4 border-l-accent" : undefined}>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <span className="text-sm">{q.label}</span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
                      q.value > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q.value}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {d.activeVendors === 0 ? (
        <Card className="mt-6">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No vendors yet. Add the first one under Vendors — the marketplace opens the day it has a vendor and
            something to sell.
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
