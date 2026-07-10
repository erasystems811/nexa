import { requireProvider, getWallet, getAgreement } from "@/modules/provider";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { BankForm } from "./bank-form";

const KIND_LABEL: Record<string, string> = {
  stage_release: "Payment released",
  rider_payout: "Rider payout",
  refund: "Refund",
  penalty: "Penalty",
  commission: "Commission",
  hold: "Held",
};

/** Wallet & payouts. PRD Sections 10, 13. */
export default async function StudioWallet() {
  const provider = await requireProvider();
  const [{ wallet, payouts, ledger }, agreement] = await Promise.all([
    getWallet(provider.id),
    getAgreement(provider.id),
  ]);

  return (
    <>
      <PageHeader title="Wallet" subtitle="Payouts settle on a schedule, so Admin can catch disputes first." />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Available" value={formatKobo(wallet.available_kobo)} />
        <Stat label="Pending" value={formatKobo(wallet.pending_kobo)} />
        <Stat label="Withdrawn" value={formatKobo(wallet.withdrawn_kobo)} />
      </div>

      {agreement ? (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold">Your terms</h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
            Set by Admin at onboarding. To change them, contact Nexa.
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-[color:var(--color-ink-muted)]">Deposit</dt>
              <dd>{agreement.deposit_percent}%</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold">Payout account</h2>
        <BankForm
          defaults={{
            bank_code: wallet.bank_code ?? "",
            bank_account_number: wallet.bank_account_number ?? "",
            bank_account_name: wallet.bank_account_name ?? "",
          }}
        />
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
        {ledger.length === 0 && payouts.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-muted)]">No activity yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between">
                <span className="text-[color:var(--color-ink-muted)]">
                  {KIND_LABEL[l.kind] ?? l.kind}
                  {l.stage ? ` (stage ${l.stage})` : ""}
                </span>
                <span className={`tabular-nums ${l.amount_kobo < 0 ? "text-[color:var(--color-danger)]" : ""}`}>
                  {formatKobo(l.amount_kobo)}
                </span>
              </li>
            ))}
          </ul>
        )}
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
