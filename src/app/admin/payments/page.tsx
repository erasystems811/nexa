import Link from "next/link";
import type { Route } from "next";
import { requireView, moneyOverview, vendorsWaitingToBePaid, recentMoneyMoves, PERMISSIONS as P } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";

const MOVE: Record<string, string> = {
  hold: "Paid by a customer",
  stage_release: "Paid to a vendor",
  refund: "Sent back to a customer",
};

/** Money. What Nexa is holding, who is waiting for it, where it has gone. */
export default async function MoneyPage() {
  await requireView(P.paymentsView);
  const [o, waiting, moves] = await Promise.all([moneyOverview(), vendorsWaitingToBePaid(), recentMoneyMoves(40)]);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Money</h1>

      <Card className="mt-6 bg-zinc-900 text-zinc-100">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wide text-zinc-400">Money Nexa is holding right now</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{formatKobo(o.holdingKobo)}</p>
          <p className="mt-2 text-xs text-zinc-400">
            Across {o.holdingCount} booking{o.holdingCount === 1 ? "" : "s"} that are not settled yet.
          </p>
        </CardContent>
      </Card>

      <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Paid to vendors" value={formatKobo(o.paidToVendorsKobo)} />
        <Stat label="Sent back to customers" value={formatKobo(o.refundedKobo)} />
        <Stat label="Nexa has kept" value={formatKobo(o.keptKobo)} />
      </section>

      <h2 className="mb-2 mt-8 font-serif text-lg font-semibold">Vendors waiting to be paid</h2>
      {waiting.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nobody is waiting. Every finished job has been settled.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {waiting.map((w) => (
            <li key={w.bookingId}>
              <Link href={`/orders/${w.bookingId}` as Route}>
                <Card className="border-l-4 border-l-accent transition hover:border-l-accent/70">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{w.vendor}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{w.reference}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatKobo(w.stillHeldKobo)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">held · open to pay</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6">
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold">Recent movements</h2>
          {moves.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No money has moved yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {moves.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{MOVE[m.kind] ?? m.kind}</span>
                  <span className={`shrink-0 tabular-nums ${m.amount_kobo < 0 ? "text-destructive" : ""}`}>
                    {formatKobo(m.amount_kobo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        A customer pays the whole price to Nexa. It stays with Nexa until you open the booking and pay the vendor —
        all of it, or part of it. Whatever you never pay out, Nexa keeps.
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
