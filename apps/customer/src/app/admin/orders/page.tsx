import Link from "next/link";
import type { Route } from "next";
import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { listOrders } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"] as const;

/** Order monitoring. */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireView(P.ordersView);
  const { status } = await searchParams;
  const orders = await listOrders(status);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every booking across the platform.</p>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        <Filter label="All" href="/orders" active={!status} />
        {STATUSES.map((s) => (
          <Filter key={s} label={s.replace("_", " ")} href={`/orders?status=${s}` as Route} active={status === s} />
        ))}
      </div>
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`}>
              <Card className="border-l-4 border-l-primary transition hover:border-l-accent">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs">{o.reference}</p>
                    <p className="mt-0.5 truncate text-sm">
                      {(o.listings as unknown as { title: string } | null)?.title} ·{" "}
                      {(o.providers as unknown as { business_name: string } | null)?.business_name}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill status={o.status} />
                    <p className="mt-1 text-sm tabular-nums">{formatKobo(o.agreed_price_kobo)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">No orders here.</CardContent>
          </Card>
        ) : null}
      </ul>
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
