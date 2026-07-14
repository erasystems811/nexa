import { requireProvider, getWallet } from "@/modules/provider";
import { listBanks } from "@/modules/payments";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { BankForm } from "./bank-form";

/** The only three things that can happen to money, since 0030. */
const KIND_LABEL: Record<string, string> = {
  hold: "Held by Nexa",
  stage_release: "Paid to you",
  refund: "Refunded to the customer",
};

/** Wallet & payouts. */
export default async function StudioWallet() {
  const provider = await requireProvider();
  const [{ wallet, payouts, ledger }, banks] = await Promise.all([
    getWallet(provider.id),
    listBanks(),
  ]);

  return (
    <>
      <PageHeader title="Wallet" subtitle="Payouts settle on a schedule, so Admin can catch disputes first." />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Available" value={formatKobo(wallet.available_kobo)} />
        <Stat label="Pending" value={formatKobo(wallet.pending_kobo)} />
        <Stat label="Withdrawn" value={formatKobo(wallet.withdrawn_kobo)} />
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold">How you get paid</h2>
        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
          The customer pays and Nexa holds the whole amount. When the job is done
          and the customer gives you their completion code, Nexa pays you. There is
          no deposit and nothing is deducted.
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold">Payout account</h2>
        <p className="mb-3 mt-1 text-xs text-[color:var(--color-ink-muted)]">
          Where Nexa sends your money. Get it wrong and the payment goes nowhere — check the
          account name is the one your bank has for you.
        </p>
        <BankForm
          banks={banks}
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
