import Link from "next/link";
import type { Route } from "next";
import { requireProvider, providerDashboard } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

/** Studio dashboard. */
export default async function StudioHome() {
  const provider = await requireProvider();
  const stats = await providerDashboard(provider.id);

  return (
    <>
      <PageHeader
        title={provider.business_name}
        subtitle={provider.is_on_probation ? "New provider — your first bookings get closer attention." : undefined}
      />

      {stats.awaitingResponse > 0 ? (
        <Link href={"/orders" as Route}>
          <Card className="mb-4 border-[color:var(--color-ink)]">
            <p className="text-sm font-medium">
              {stats.awaitingResponse} booking{stats.awaitingResponse === 1 ? "" : "s"} awaiting your response
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
              Already paid and held. Accept or decline.
            </p>
          </Card>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Today" value={String(stats.todayCount)} />
        <Stat label="Upcoming" value={String(stats.upcomingCount)} />
        <Stat label="Available to withdraw" value={formatKobo(stats.wallet.available_kobo)} />
        <Stat label="Pending earnings" value={formatKobo(stats.wallet.pending_kobo)} />
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">Rating</p>
            <p className="mt-1 text-2xl font-semibold">
              {stats.rating?.review_count ? `${stats.rating.avg_rating} ★` : "—"}
            </p>
          </div>
          <Link href={"/reviews" as Route} className="text-sm underline">
            {stats.rating?.review_count ?? 0} reviews
          </Link>
        </div>
      </Card>

      {stats.pendingListings > 0 ? (
        <Card className="mt-4 text-sm text-[color:var(--color-ink-muted)]">
          {stats.pendingListings} listing{stats.pendingListings === 1 ? "" : "s"} awaiting Admin approval.
        </Card>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-[color:var(--color-ink-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
