import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatKobo } from "@nexa/money";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { apiGet } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { PERMISSIONS as P, can } from "../lib/permissions";

interface MoneyOverview {
  /** Taken from customers, not paid out or refunded, job not finished yet. */
  holdingKobo: number;
  /** How many bookings that held money is spread across. */
  holdingCount: number;
  /** Sent to vendors' bank accounts, all time. */
  paidToVendorsKobo: number;
  /** Sent back to customers, all time. */
  refundedKobo: number;
  /** Left over on finished jobs — what Nexa has kept. */
  keptKobo: number;
}

interface VendorWaiting {
  bookingId: string;
  reference: string;
  status: string;
  vendor: string;
  stillHeldKobo: number;
}

interface MoneyMove {
  id: string;
  kind: string;
  amount_kobo: number;
}

const MOVE: Record<string, string> = {
  hold: "Paid by a customer",
  stage_release: "Paid to a vendor",
  refund: "Sent back to a customer",
};

/** Money. What Nexa is holding, who is waiting for it, where it has gone. */
export function PaymentsPage() {
  const { staff } = useAuth();
  const canView = can(staff, P.paymentsView);

  const [o, setO] = useState<MoneyOverview | null>(null);
  const [waiting, setWaiting] = useState<VendorWaiting[]>([]);
  const [moves, setMoves] = useState<MoneyMove[]>([]);

  useEffect(() => {
    if (!canView) return;
    apiGet<MoneyOverview>("/admin/money/overview").then(setO);
    apiGet<VendorWaiting[]>("/admin/money/vendors-waiting").then(setWaiting).catch(() => setWaiting([]));
    apiGet<MoneyMove[]>("/admin/money/recent").then(setMoves).catch(() => setMoves([]));
  }, [canView]);

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>;
  }

  if (!o) return <div className="text-muted-foreground">Loading…</div>;

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
              <Link to={`/orders/${w.bookingId}`}>
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
