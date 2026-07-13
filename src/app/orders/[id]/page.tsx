import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { getMyOrder, checkpointsFor } from "@/modules/bookings";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";

/**
 * Booking detail.
 *
 * The completion code is the point of this screen. It is the customer's, it is
 * the only thing that releases the vendor's balance, and it is deliberately
 * front and centre rather than buried. No RLS policy shows it to the vendor.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();

  const result = await getMyOrder(id);
  if (!result) notFound();

  const { booking, codes } = result;
  const checkpoints = checkpointsFor(booking.fulfillment_type);
  const code = codes[0] ?? null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <PageHeader title={booking.listings.title} subtitle={booking.providers.business_name} />

      <div className="flex items-center justify-between">
        <StatusPill status={booking.status} />
        <p className="font-mono text-xs text-[color:var(--color-ink-muted)]">{booking.reference}</p>
      </div>

      {code ? (
        <section className="mt-6">
          <Card className="border-[color:var(--color-ink)]">
            <h2 className="text-sm font-medium">Your completion code</h2>
            <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
              Only you can see this. Give it to the vendor when the job is done and
              you are happy — that is what releases the rest of their payment. Never
              share it beforehand.
            </p>

            <div className="mt-4 flex items-center justify-between">
              {code.consumed_at ? (
                <p className="text-[11px] text-[color:var(--color-success)]">Used</p>
              ) : (
                <span />
              )}
              <p
                className={`font-mono text-2xl font-semibold tracking-[0.2em] ${code.consumed_at ? "text-[color:var(--color-ink-muted)] line-through" : ""}`}
              >
                {code.code}
              </p>
            </div>
          </Card>
        </section>
      ) : null}

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Progress</h2>
        <ol className="mt-3 space-y-3 text-sm">
          <Step done={!!booking.accepted_at} label="Vendor accepted" />
          <Step done={!!booking.stage_1_at} label={checkpoints.stage1} />
          <Step done={!!booking.stage_2_at} label={checkpoints.stage2} />
        </ol>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Payment</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Price" value={formatKobo(booking.agreed_price_kobo)} />
          <div className="flex justify-between border-t border-[color:var(--color-line)] pt-2 font-medium">
            <dt>Held by Nexa</dt>
            <dd className="tabular-nums">{formatKobo(booking.agreed_price_kobo)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[color:var(--color-ink-muted)]">
          Nexa is holding your money. {booking.stage_1_release_percent}% goes to the
          vendor as a deposit when they accept, so they can prepare. The rest is only
          released when you give them your completion code.
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">When</h2>
        <p className="mt-1 text-sm">
          {new Date(booking.scheduled_start).toLocaleString("en-NG")}
        </p>
        {booking.address ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">{booking.address}</p>
        ) : null}
      </Card>
    </main>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${done ? "bg-[color:var(--color-ink)] text-white" : "border border-[color:var(--color-line)]"}`}
      >
        {done ? "✓" : ""}
      </span>
      <span className={done ? "" : "text-[color:var(--color-ink-muted)]"}>{label}</span>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[color:var(--color-ink-muted)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
