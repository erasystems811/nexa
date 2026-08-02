import Link from "next/link";
import type { Route } from "next";
import { requireProvider, listProviderOrders } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { OrderActions } from "./order-actions";

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"] as const;

/** Orders. Providers own ordinary fulfillment. */
export default async function StudioOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const provider = await requireProvider();
  const { status } = await searchParams;
  const allOrders = await listProviderOrders(provider.id);
  const orders = status ? allOrders.filter((o) => o.status === status) : allOrders;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Accept bookings, coordinate fulfillment, and complete events.
      </p>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        <Filter label="All" href="/studio/orders" active={!status} />
        {STATUSES.map((s) => (
          <Filter
            key={s}
            label={s.replace("_", " ")}
            href={`/studio/orders?status=${s}` as Route}
            active={status === s}
          />
        ))}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {allOrders.length === 0 ? "No orders yet." : "No orders match that filter."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
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

function Filter({ label, href, active }: { label: string; href: Route; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
        active ? "border-accent bg-accent text-accent-foreground" : "hover:border-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
