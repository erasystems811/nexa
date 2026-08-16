import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatKobo } from "@nexa/money";
import type { BookingStatus } from "@nexa/db-types";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { StatusPill } from "../components/status-pill";
import { apiGet } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"] as const;

interface OrderListItem {
  id: string;
  reference: string;
  status: BookingStatus;
  fulfillment_type: string;
  scheduled_start: string;
  agreed_price_kobo: number;
  created_at: string;
  listings: { title: string } | null;
  providers: { business_name: string } | null;
}

/** Order monitoring. */
export function OrdersPage() {
  const { staff } = useAuth();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") ?? undefined;
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const allowed = can(staff, P.ordersView);

  useEffect(() => {
    if (!allowed) return;
    setOrders(null);
    apiGet<OrderListItem[]>("/admin/orders", { status }).then(setOrders);
  }, [status, allowed]);

  if (!allowed) return <div className="text-muted-foreground">You don&rsquo;t have permission to view bookings.</div>;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every booking across the platform.</p>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        <Filter label="All" href="/orders" active={!status} />
        {STATUSES.map((s) => (
          <Filter key={s} label={s.replace("_", " ")} href={`/orders?status=${s}`} active={status === s} />
        ))}
      </div>

      {orders === null ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`}>
                <Card className="border-l-4 border-l-primary transition hover:border-l-accent">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{o.reference}</p>
                      <p className="mt-0.5 truncate text-sm">
                        {o.listings?.title} · {o.providers?.business_name}
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
      )}
    </>
  );
}

function Filter({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      to={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
        active ? "border-accent bg-accent text-accent-foreground" : "hover:border-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
