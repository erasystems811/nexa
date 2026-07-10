import { notFound } from "next/navigation";
import { requireSession } from "@/modules/auth";
import { getMyOrder, checkpointsFor } from "@/modules/bookings";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";

const CODE_LABEL: Record<number, string> = {
  1: "Drop-off code",
  2: "Completion code",
};

/**
 * Order detail. PRD Section 14: "Each booking displays the customer's delivery
 * confirmation code — the customer never has to search for it; it's front and
 * centre on the order once payment is made."
 *
 * These codes come back only because the caller is the customer. There is no
 * RLS policy that shows them to a provider or a rider, by design.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();

  const result = await getMyOrder(id);
  if (!result) notFound();

  const { booking, codes } = result;
  const checkpoints = checkpointsFor(booking.fulfillment_type);
  const total = booking.agreed_price_kobo + booking.delivery_fee_kobo + booking.caution_fee_kobo;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <PageHeader title={booking.listings.title} subtitle={booking.providers.business_name} />

      <div className="flex items-center justify-between">
        <StatusPill status={booking.status} />
        <p className="font-mono text-xs text-[color:var(--color-ink-muted)]">{booking.reference}</p>
      </div>

      {codes.length > 0 ? (
        <section className="mt-6">
          <Card className="border-[color:var(--color-ink)]">
            <h2 className="text-sm font-medium">
              {codes.length === 2 ? "Your confirmation codes" : "Your confirmation code"}
            </h2>
            <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
              Only you can see this. Read it out when the job is done — that is what
              releases the payment. Never share it beforehand.
            </p>

            <ul className="mt-4 space-y-3">
              {codes.map((c) => (
                <li key={c.stage} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[color:var(--color-ink-muted)]">
                      {codes.length === 2 ? CODE_LABEL[c.stage] : "Completion code"}
                    </p>
                    {c.consumed_at ? (
                      <p className="text-[11px] text-[color:var(--color-success)]">Used</p>
                    ) : null}
                  </div>
                  <p
                    className={`font-mono text-2xl font-semibold tracking-[0.2em] ${c.consumed_at ? "text-[color:var(--color-ink-muted)] line-through" : ""}`}
                  >
                    {c.code}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Progress</h2>
        <ol className="mt-3 space-y-3 text-sm">
          <Step done={!!booking.accepted_at} label="Provider confirmed" />
          <Step done={!!booking.stage_1_at} label={checkpoints.stage1} />
          <Step done={!!booking.stage_2_at} label={checkpoints.stage2} />
        </ol>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Payment</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Price" value={formatKobo(booking.agreed_price_kobo)} />
          {booking.delivery_fee_kobo > 0 ? (
            <Row label="Delivery" value={formatKobo(booking.delivery_fee_kobo)} />
          ) : null}
          {booking.caution_fee_kobo > 0 ? (
            <Row
              label="Caution fee (refundable)"
              value={formatKobo(booking.caution_fee_kobo)}
            />
          ) : null}
          <div className="flex justify-between border-t border-[color:var(--color-line)] pt-2 font-medium">
            <dt>Held by Nexa</dt>
            <dd className="tabular-nums">{formatKobo(total)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[color:var(--color-ink-muted)]">
          Released in two stages: {booking.stage_1_release_percent}% at the first
          checkpoint, the remainder on your code.
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
