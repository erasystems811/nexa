import Link from "next/link";
import { requireSession } from "@/modules/auth";
import { listMyOrders } from "@/modules/bookings";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { BackBar } from "@/components/back-bar";

/** My Orders. */
export default async function OrdersPage() {
  await requireSession();
  const orders = await listMyOrders();

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <BackBar className="mb-4" />
      <PageHeader title="My orders" subtitle="Live status for everything you have booked." />

      {orders.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          Nothing booked yet.
        </Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`}>
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.listings.title}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                        {o.providers.business_name} ·{" "}
                        {new Date(o.scheduled_start).toLocaleString("en-NG")}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[color:var(--color-ink-muted)]">
                        {o.reference}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusPill status={o.status} />
                      <p className="mt-1 text-sm tabular-nums">
                        {formatKobo(o.agreed_price_kobo)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
