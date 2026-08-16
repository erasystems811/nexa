import { useEffect, useState, type FormEvent } from "react";
import { Wallet as WalletIcon, HourglassIcon, CheckCircle2 } from "lucide-react";
import { formatKobo } from "@nexa/money";
import { Card, CardContent, CardHeader, CardTitle } from "@nexa/design-system/src/components/ui/card";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { Label } from "@nexa/design-system/src/components/ui/label";
import { apiGet, apiSend, ApiError } from "../lib/api";

/** The only three things that can happen to money, since 0030. */
const KIND_LABEL: Record<string, string> = {
  hold: "Held by Nexa",
  stage_release: "Paid to you",
  refund: "Refunded to the customer",
};

interface Bank {
  code: string;
  name: string;
}

interface Wallet {
  pending_kobo: number;
  available_kobo: number;
  withdrawn_kobo: number;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

interface LedgerEntry {
  id: string;
  kind: string;
  amount_kobo: number;
  stage: number | null;
  note: string | null;
  created_at: string;
}

interface Payout {
  id: string;
  amount_kobo: number;
  status: string;
  scheduled_for: string | null;
  paid_at: string | null;
  created_at: string;
}

interface WalletData {
  wallet: Wallet;
  payouts: Payout[];
  ledger: LedgerEntry[];
}

/** Wallet & payouts. */
export function WalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [banks, setBanks] = useState<Bank[] | null>(null);

  useEffect(() => {
    apiGet<WalletData>("/provider/wallet").then(setData);
    apiGet<Bank[]>("/provider/banks")
      .then(setBanks)
      .catch(() => setBanks([]));
  }, []);

  if (!data || banks === null) return <div className="text-muted-foreground">Loading…</div>;

  const { wallet, payouts, ledger } = data;

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Wallet</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Payouts settle on a schedule, so Admin can catch disputes first.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

/**
 * Where Nexa sends the vendor's money.
 *
 * This asked for a "Bank code" and expected a vendor to type 058. Nobody knows
 * that number — they would type "GTBank", or guess, and the payout would fail
 * weeks later looking like Nexa refusing to pay them. Now they pick their bank
 * by name and Nexa keeps the code to itself.
 *
 * The typed field survives as a fallback for the one case that matters: if the
 * payment processor cannot be reached, the list arrives empty, and a vendor
 * with no way to enter an account at all would be worse than one typing a code.
 */
function BankForm({
  banks,
  defaults,
}: {
  banks: Bank[];
  defaults: { bank_code: string; bank_account_number: string; bank_account_name: string };
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const bank_code = String(form.get("bank_code") ?? "");
    const bank_account_number = String(form.get("bank_account_number") ?? "");
    const bank_account_name = String(form.get("bank_account_name") ?? "");

    setPending(true);
    setError(null);
    setOk(false);
    try {
      await apiSend("PATCH", "/provider/wallet/bank", { bank_code, bank_account_number, bank_account_name });
      setOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {banks.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="bank_code">Your bank</Label>
          <select
            id="bank_code"
            name="bank_code"
            required
            defaultValue={defaults.bank_code}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" disabled>
              Choose your bank
            </option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="bank_code">Bank code</Label>
          <Input id="bank_code" name="bank_code" defaultValue={defaults.bank_code} required />
          <p className="text-xs text-muted-foreground">
            Nexa could not load the list of banks just now. Try again in a moment, or enter your bank&rsquo;s code
            if you know it.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="bank_account_number">Account number</Label>
        <Input
          id="bank_account_number"
          name="bank_account_number"
          defaultValue={defaults.bank_account_number}
          inputMode="numeric"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bank_account_name">Account name</Label>
        <Input id="bank_account_name" name="bank_account_name" defaultValue={defaults.bank_account_name} required />
        <p className="text-xs text-muted-foreground">
          Exactly as your bank has it. A name that does not match the account will bounce the payment.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">Saved.</p> : null}

      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save payout account"}
      </Button>
    </form>
  );
}
