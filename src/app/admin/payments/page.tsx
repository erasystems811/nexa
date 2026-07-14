import Link from "next/link";
import type { Route } from "next";
import { requireView, moneyOverview, vendorsWaitingToBePaid, recentMoneyMoves, PERMISSIONS as P } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

const MOVE: Record<string, string> = {
  hold: "Paid by a customer",
  stage_release: "Paid to a vendor",
  refund: "Sent back to a customer",
};

/** Money. What Nexa is holding, who is waiting for it, where it has gone. */
export default async function MoneyPage() {
  await requireView(P.paymentsView);
  const [o, waiting, moves] = await Promise.all([
    moneyOverview(),
    vendorsWaitingToBePaid(),
    recentMoneyMoves(40),
  ]);

  return (
    <>
      <PageHeader title="Money" />

      <Card className="bg-[color:var(--color-ink)] text-white">
        <p className="text-xs text-white/70">Money Nexa is holding right now</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formatKobo(o.holdingKobo)}</p>
        <p className="mt-2 text-xs text-white/70">
          Across {o.holdingCount} booking{o.holdingCount === 1 ? "" : "s"} that are not settled yet.
        </p>
      </Card>

      <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Paid to vendors" value={formatKobo(o.paidToVendorsKobo)} />
        <Stat label="Sent back to customers" value={formatKobo(o.refundedKobo)} />
        <Stat label="Nexa has kept" value={formatKobo(o.keptKobo)} />
      </section>

      <h2 className="mt-8 mb-2 text-sm font-semibold">Vendors waiting to be paid</h2>
      {waiting.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          Nobody is waiting. Every finished job has been settled.
        </Card>
      ) : (
        <ul className="space-y-2">
          {waiting.map((w) => (
            <li key={w.bookingId}>
              <Link href={`/orders/${w.bookingId}` as Route}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{w.vendor}</p>
                    <p className="mt-0.5 font-mono text-xs text-[color:var(--color-ink-muted)]">{w.reference}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatKobo(w.stillHeldKobo)}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">held · open to pay</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6">
        <h2 className="text-sm font-semibold">Recent movements</h2>
        {moves.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">No money has moved yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex justify-between gap-3">
                <span className="text-[color:var(--color-ink-muted)]">{MOVE[m.kind] ?? m.kind}</span>
                <span
                  className={`shrink-0 tabular-nums ${m.amount_kobo < 0 ? "text-[color:var(--color-danger)]" : ""}`}
                >
                  {formatKobo(m.amount_kobo)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-[color:var(--color-ink-muted)]">
        A customer pays the whole price to Nexa. It stays with Nexa until you open the booking and pay
        the vendor — all of it, or part of it. Whatever you never pay out, Nexa keeps.
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs text-[color:var(--color-ink-muted)]">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
