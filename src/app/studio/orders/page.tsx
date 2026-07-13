import { requireProvider, listProviderOrders } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { OrderActions } from "./order-actions";

/** Orders.: providers own ordinary fulfillment. */
export default async function StudioOrders() {
  const provider = await requireProvider();
  const orders = await listProviderOrders(provider.id);

  return (
    <>
      <PageHeader title="Orders" subtitle="Accept bookings, coordinate fulfillment, and complete events." />

      {orders.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">No orders yet.</Card>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            return (
              <li key={o.id}>
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.listings.title}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                        {new Date(o.scheduled_start).toLocaleString("en-NG")}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[color:var(--color-ink-muted)]">
                        {o.reference}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusPill status={o.status} />
                      <p className="mt-1 text-sm tabular-nums">{formatKobo(o.agreed_price_kobo)}</p>
                    </div>
                  </div>

                  <OrderActions
                    bookingId={o.id}
                    status={o.status}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}