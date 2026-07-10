import Link from "next/link";
import { requireSession } from "@/modules/auth";
import { requireApprovedRider, getEarnings } from "@/modules/rider";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { RiderBankForm } from "./bank-form";

/** Earnings and reliability. PRD Section 15. */
export default async function RiderEarnings() {
  await requireSession();
  const rider = await requireApprovedRider();
  const { wallet, reliability, ledger } = await getEarnings(rider.id);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Earnings" />
        <Link href="/rider" className="text-sm underline">
          Deliveries
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Available" value={formatKobo(wallet.available_kobo)} />
        <Stat label="Pending" value={formatKobo(wallet.pending_kobo)} />
        <Stat label="Withdrawn" value={formatKobo(wallet.withdrawn_kobo)} />
      </div>

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold">{reliability.completed_deliveries}</p>
            <p className="text-xs text-[color:var(--color-ink-muted)]">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">
              {reliability.completed_deliveries > 0 ? `${reliability.on_time_rate}%` : "—"}
            </p>
            <p className="text-xs text-[color:var(--color-ink-muted)]">On time</p>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold">Payout account</h2>
        <RiderBankForm
          defaults={{
            bank_code: wallet.bank_code ?? "",
            bank_account_number: wallet.bank_account_number ?? "",
            bank_account_name: wallet.bank_account_name ?? "",
          }}
        />
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold">Payout history</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-muted)]">No earnings yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between">
                <span className="text-[color:var(--color-ink-muted)]">
                  {l.note ?? "Delivery fee"}
                  {l.stage ? ` · leg ${l.stage}` : ""}
                </span>
                <span className="tabular-nums">{formatKobo(l.amount_kobo)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
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
