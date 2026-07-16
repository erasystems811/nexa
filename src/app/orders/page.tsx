import Link from "next/link";
import type { Route } from "next";
import { requireSession } from "@/modules/auth";
import { listMyOrders } from "@/modules/bookings";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { BackBar } from "@/components/back-bar";
import type { BookingStatus } from "@/lib/db/types";

/**
 * Everything a customer has booked, sorted into the three questions they
 * actually ask — like a food app's orders tab.
 *
 *   Going on now: paid, confirmed, in progress, or under review. These are the
 *   ones that carry a completion code, so the code rides on the card.
 *   Not finished: booked but never paid for. Shown so the customer can go back
 *   and complete a booking they abandoned, rather than starting over.
 *   Past: done, declined or cancelled — the history.
 */

const ACTIVE: BookingStatus[] = ["paid_held", "accepted", "in_progress", "disputed"];
const UNFINISHED: BookingStatus[] = ["pending"];

type Order = Awaited<ReturnType<typeof listMyOrders>>[number];

function liveCode(order: Order): string | null {
  const codes = (order.booking_confirmation_codes ?? []) as Array<{
    stage: number;
    code: string;
    consumed_at: string | null;
  }>;
  const unused = codes.filter((c) => !c.consumed_at).sort((a, b) => a.stage - b.stage);
  return unused[0]?.code ?? null;
}

export default async function OrdersPage() {
  await requireSession();
  const orders = await listMyOrders();

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const unfinished = orders.filter((o) => UNFINISHED.includes(o.status));
  const past = orders.filter(
    (o) => !ACTIVE.includes(o.status) && !UNFINISHED.includes(o.status),
  );

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <BackBar className="mb-4" />
      <PageHeader title="My orders" subtitle="Everything you have booked, and where each one stands." />

      {orders.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          Nothing booked yet. When you book a vendor, it shows up here — with the code that releases
          their payment once your event is done.
        </Card>
      ) : (
        <div className="space-y-8">
          <Section title="Going on now" empty="Nothing in progress right now.">
            {active.map((o) => (
              <OrderRow key={o.id} order={o} showCode />
            ))}
          </Section>

          {unfinished.length > 0 ? (
            <Section title="Not finished" hint="You started these but never paid. Open one to complete it.">
              {unfinished.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </Section>
          ) : null}

          <Section title="Past orders" empty="No past orders yet.">
            {past.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </Section>
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  hint,
  empty,
  children,
}: {
  title: string;
  hint?: string;
  empty?: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) && items.length === 0;

  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">{hint}</p> : null}
      <div className="mt-3 space-y-3">
        {isEmpty ? (
          empty ? (
            <p className="text-sm text-[color:var(--color-ink-muted)]">{empty}</p>
          ) : null
        ) : (
          items
        )}
      </div>
    </section>
  );
}

function OrderRow({ order: o, showCode = false }: { order: Order; showCode?: boolean }) {
  const code = showCode ? liveCode(o) : null;
  const listing = o.listings as unknown as { title: string } | null;
  const provider = o.providers as unknown as { business_name: string } | null;

  return (
    <Link href={`/orders/${o.id}` as Route} className="block">
      <Card className="transition hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{listing?.title ?? "Booking"}</p>
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
              {provider?.business_name}
              {" · "}
              {new Date(o.scheduled_start).toLocaleString("en-NG", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
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

        {code ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[color:var(--color-surface-sunk)] px-3 py-2">
            <span className="text-xs text-[color:var(--color-ink-muted)]">Your completion code</span>
            <span className="font-mono text-sm font-semibold tracking-[0.2em]">{code}</span>
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
