import { Wallet as WalletIcon, HourglassIcon, CheckCircle2 } from "lucide-react";
import { requireProvider, getWallet } from "@/modules/provider";
import { listBanks } from "@/modules/payments";
import { formatKobo } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [{ wallet, payouts, ledger }, banks] = await Promise.all([getWallet(provider.id), listBanks()]);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Wallet</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Payouts settle on a schedule, so Admin can catch disputes first.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Available" value={formatKobo(wallet.available_kobo)} icon={<WalletIcon className="size-4" />} />
        <Stat label="Pending" value={formatKobo(wallet.pending_kobo)} icon={<HourglassIcon className="size-4" />} />
        <Stat
          label="Withdrawn"
          value={formatKobo(wallet.withdrawn_kobo)}
          icon={<CheckCircle2 className="size-4" />}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">How you get paid</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          The customer pays and Nexa holds the whole amount. When the job is done and the customer gives you their
          completion code, Nexa pays you. There is no deposit and nothing is deducted.
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Payout account</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="mb-3 text-xs text-muted-foreground">
            Where Nexa sends your money. Get it wrong and the payment goes nowhere — check the account name is the
            one your bank has for you.
          </p>
          <BankForm
            banks={banks}
            defaults={{
              bank_code: wallet.bank_code ?? "",
              bank_account_number: wallet.bank_account_number ?? "",
              bank_account_name: wallet.bank_account_name ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {ledger.length === 0 && payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {ledger.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <span className="text-muted-foreground">
                    {KIND_LABEL[l.kind] ?? l.kind}
                    {l.stage ? ` (stage ${l.stage})` : ""}
                  </span>
                  <span className={`tabular-nums ${l.amount_kobo < 0 ? "text-destructive" : ""}`}>
                    {formatKobo(l.amount_kobo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
        </div>
        <p className="text-base font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
