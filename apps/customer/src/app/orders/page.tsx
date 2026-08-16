import Link from "next/link";
import type { Route } from "next";
import { Calendar, ChevronRight } from "lucide-react";
import { requireSession } from "@/modules/auth";
import { listMyOrders } from "@/modules/bookings";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import { ResumePaymentButton } from "./resume-payment-button";
import { BackLink } from "@/components/back-link";
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

type Tab = "active" | "unfinished" | "past";
const TABS: { key: Tab; label: string }[] = [
  { key: "unfinished", label: "Not finished" },
  { key: "active", label: "Active" },
  { key: "past", label: "Past orders" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSession();
  const orders = await listMyOrders();

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const unfinished = orders.filter((o) => UNFINISHED.includes(o.status));
  const past = orders.filter(
    (o) => !ACTIVE.includes(o.status) && !UNFINISHED.includes(o.status),
  );

  const { tab } = await searchParams;
  const current: Tab = tab === "unfinished" || tab === "past" ? tab : "active";
  const counts: Record<Tab, number> = {
    active: active.length,
    unfinished: unfinished.length,
    past: past.length,
  };

  return (
    <div className="space-y-8">
      <BackLink />
      <div>
        <h1 className="mb-2 font-serif text-3xl font-bold text-primary">My Orders</h1>
        <p className="text-muted-foreground">Manage your event services and payments.</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Nothing booked yet.</CardContent>
        </Card>
      ) : (
        <>
          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/orders?tab=${t.key}` as Route}
                className={cn(buttonVariants({ variant: current === t.key ? "default" : "outline" }))}
              >
                {t.label}
                {counts[t.key] > 0 ? ` (${counts[t.key]})` : ""}
              </Link>
            ))}
          </div>

          {current === "active" ? (
            <Section title="Active" empty="Nothing in progress right now.">
              {active.map((o) => (
                <OrderRow key={o.id} order={o} showCode />
              ))}
            </Section>
          ) : null}

          {current === "unfinished" ? (
            <Section
              title="Not finished"
              hint="Started but not paid yet — finish to confirm."
              empty="Nothing unpaid. You're all caught up."
            >
              {unfinished.map((o) => (
                <OrderRow key={o.id} order={o} resumable />
              ))}
            </Section>
          ) : null}

          {current === "past" ? (
            <Section title="Past orders" empty="No past orders yet.">
              {past.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
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
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 space-y-4">
        {isEmpty ? (
          empty ? (
            <div className="py-12 text-center text-muted-foreground">{empty}</div>
          ) : null
        ) : (
          items
        )}
      </div>
    </section>
  );
}

function OrderRow({
  order: o,
  showCode = false,
  resumable = false,
}: {
  order: Order;
  showCode?: boolean;
  resumable?: boolean;
}) {
  const code = showCode ? liveCode(o) : null;
  const listing = o.listings as unknown as { title: string } | null;
  const provider = o.providers as unknown as { business_name: string } | null;

  const body = (
    <CardContent className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
      <div className="flex flex-1 items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Calendar className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold group-hover:text-primary">
            {listing?.title ?? "Booking"}
          </h3>
          <p className="text-sm font-medium text-muted-foreground">{provider?.business_name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusPill status={o.status} />
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {new Date(o.scheduled_start).toLocaleString("en-NG", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{o.reference}</p>

          {code ? (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-secondary/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">Your completion code</span>
              <span className="font-mono text-sm font-semibold tracking-[0.2em]">{code}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-6 border-t border-border pt-4 md:w-auto md:justify-end md:border-t-0 md:pt-0">
        <div className="text-left md:text-right">
          <div className="mb-1 text-sm text-muted-foreground">Total</div>
          <div className="text-lg font-bold tabular-nums">{formatKobo(o.agreed_price_kobo)}</div>
        </div>
        {!resumable ? (
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
        ) : null}
      </div>
    </CardContent>
  );

  // A resumable (unpaid) order cannot be a link — it carries a form button, which
  // may not sit inside an anchor. It gets the button and a plain details link.
  if (resumable) {
    return (
      <Card>
        {body}
        <div className="space-y-2 px-6 pb-6">
          <ResumePaymentButton bookingId={o.id} />
          <Link href={`/orders/${o.id}` as Route} className="block text-center text-xs text-muted-foreground underline">
            View details
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Link href={`/orders/${o.id}` as Route} className="block">
      <Card className="group cursor-pointer transition-colors hover:border-primary/50">{body}</Card>
    </Link>
  );
}
