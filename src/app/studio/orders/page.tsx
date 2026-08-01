import { requireProvider, listProviderOrders } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { OrderActions } from "./order-actions";

/** Orders. Providers own ordinary fulfillment. */
export default async function StudioOrders() {
  const provider = await requireProvider();
  const orders = await listProviderOrders(provider.id);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Accept bookings, coordinate fulfillment, and complete events.
      </p>

      {orders.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="pt-6 text-sm text-muted-foreground">No orders yet.</CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.listings.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(o.scheduled_start).toLocaleString("en-NG")}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{o.reference}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusPill status={o.status} />
                      <p className="mt-1 text-sm tabular-nums">{formatKobo(o.agreed_price_kobo)}</p>
                    </div>
                  </div>

                  <OrderActions bookingId={o.id} status={o.status} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
