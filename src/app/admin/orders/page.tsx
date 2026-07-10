import Link from "next/link";
import type { Route } from "next";
import { requireRole } from "@/modules/auth";
import { listOrders } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"] as const;

/** Order monitoring. PRD Section 12. */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("admin");
  const { status } = await searchParams;
  const orders = await listOrders(status);

  return (
    <>
      <PageHeader title="Orders" subtitle="Every booking across the platform." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Filter label="All" href="/admin/orders" active={!status} />
        {STATUSES.map((s) => (
          <Filter key={s} label={s.replace("_", " ")} href={`/admin/orders?status=${s}` as Route} active={status === s} />
        ))}
      </div>
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.id}`}>
              <Card className="flex items-center justify-between">
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
              </Card>
            </Link>
          </li>
        ))}
        {orders.length === 0 ? <Card className="text-sm text-[color:var(--color-ink-muted)]">No orders here.</Card> : null}
      </ul>
    </>
  );
}

function Filter({ label, href, active }: { label: string; href: Route; active: boolean }) {
  return (
    <Link href={href} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${active ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white" : "border-[color:var(--color-line)]"}`}>
      {label}
    </Link>
  );
}
