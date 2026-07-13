import { requireView, PERMISSIONS as P } from "@/modules/admin";
import { paymentOverview, recentLedger, pendingPayouts } from "@/modules/admin";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

const KIND: Record<string, string> = {
  hold: "Held", stage_release: "Released", commission: "Commission",
  penalty: "Penalty", refund: "Refund", caution_hold: "Caution held", caution_refund: "Caution refund", caution_claim: "Caution claim",
};

/** Payment management. */
export default async function PaymentsPage() {
  await requireView(P.paymentsView);
  const [o, ledger, payouts] = await Promise.all([paymentOverview(), recentLedger(60), pendingPayouts()]);

  return (
    <>
      <PageHeader title="Payments" subtitle="Escrow, commission, penalties, refunds — read from the ledger." />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="In escrow" value={formatKobo(o.inEscrow)} />
        <Stat label="Commission" value={formatKobo(o.commission)} />
        <Stat label="Released" value={formatKobo(o.released)} />
        <Stat label="Refunded" value={formatKobo(o.refunded)} />
        <Stat label="Penalties" value={formatKobo(o.penalties)} />
      </section>

      {payouts.length > 0 ? (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold">Pending payouts ({payouts.length})</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="text-[color:var(--color-ink-muted)]">{p.provider_id ? "Provider" : "Legacy delivery"}</span>
                <span className="tabular-nums">{formatKobo(p.amount_kobo)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4">
        <h2 className="text-sm font-semibold">Recent ledger</h2>
        {ledger.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">No money has moved yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span className="text-[color:var(--color-ink-muted)]">{KIND[l.kind] ?? l.kind}</span>
                <span className={`tabular-nums ${l.amount_kobo < 0 ? "text-[color:var(--color-danger)]" : ""}`}>{formatKobo(l.amount_kobo)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 text-xs text-[color:var(--color-ink-muted)]">
        Commission %, stage-1 release %, and the 30/70 penalty split are all
        <a href="/settings" className="underline"> Settings</a> — editable, never hardcoded.
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-ink-muted)]">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
