"use client";

import { useActionState, useState } from "react";
import {
  payVendorAction,
  refundAction,
  overrideStatusAction,
  type AdminActionState,
} from "@/modules/admin/actions";
import { Alert, Card } from "@/components/ui";
import { formatKobo, koboToNaira } from "@/lib/money";

/**
 * THE core admin job: Nexa is holding the customer's money, the job is done, and
 * a person decides how much of it the vendor gets. The amount starts at
 * everything still held and can only be lowered — the server refuses anything
 * above it, and this form will not even offer it.
 */
export function PayVendor({
  bookingId,
  vendorPayKobo,
  nexaCommissionKobo,
  stillOwedVendorKobo,
  commissionPercent,
}: {
  bookingId: string;
  vendorPayKobo: number;
  nexaCommissionKobo: number;
  stillOwedVendorKobo: number;
  commissionPercent: number;
}) {
  const [state, action, pending] = useActionState(payVendorAction, {} as AdminActionState);
  const maxNaira = koboToNaira(stillOwedVendorKobo);
  const [naira, setNaira] = useState(String(Math.floor(maxNaira)));

  const entered = Number(naira);
  const tooMuch = Number.isFinite(entered) && entered > maxNaira;
  const alreadyPaidKobo = vendorPayKobo - stillOwedVendorKobo;

  return (
    <Card className="mt-4 border-[color:var(--color-ink)]">
      <h2 className="text-base font-semibold">Pay the vendor</h2>
      <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
        This vendor&rsquo;s pay on this booking is{" "}
        <strong className="text-[color:var(--color-ink)]">{formatKobo(vendorPayKobo)}</strong>
        {commissionPercent > 0 ? (
          <>
            {" "}&mdash; the customer&rsquo;s payment less Nexa&rsquo;s {commissionPercent}% commission of{" "}
            <strong className="text-[color:var(--color-ink)]">{formatKobo(nexaCommissionKobo)}</strong>, which Nexa keeps.
          </>
        ) : (
          "."
        )}
        {alreadyPaidKobo > 0 ? ` You have already sent them ${formatKobo(alreadyPaidKobo)}.` : ""}
      </p>
      <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
        Send everything that&rsquo;s left, or part of it as a deposit before the job is done. The
        commission is never part of this.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs font-medium">
          Amount to pay the vendor (₦)
          <input
            name="amount"
            type="number"
            min="1"
            max={maxNaira}
            step="any"
            required
            value={naira}
            onChange={(e) => setNaira(e.target.value)}
            className="mt-1 block h-12 w-48 rounded-xl border border-[color:var(--color-line)] px-4 text-base tabular-nums outline-none focus:border-[color:var(--color-ink)]"
          />
        </label>
        <button
          type="submit"
          disabled={pending || tooMuch || entered <= 0}
          className="h-12 rounded-full bg-[color:var(--color-ink)] px-6 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Sending…" : "Release to vendor"}
        </button>
      </form>

      {tooMuch ? (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">
          The most you can pay this vendor now is {formatKobo(stillOwedVendorKobo)}. The rest is Nexa&rsquo;s commission.
        </p>
      ) : null}

      {state.error ? <div className="mt-3"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? <div className="mt-3"><Alert tone="success">Sent to the vendor&rsquo;s bank account.</Alert></div> : null}
    </Card>
  );
}

/** Money back to the customer. Also capped at what Nexa is still holding. */
export function RefundCustomer({ bookingId, stillHeldKobo }: { bookingId: string; stillHeldKobo: number }) {
  const [state, action, pending] = useActionState(refundAction, {} as AdminActionState);

  return (
    <Card className="mt-3">
      <h2 className="text-sm font-semibold">Refund the customer</h2>
      <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
        Sends money back from what Nexa is holding — at most {formatKobo(stillHeldKobo)}.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <label className="text-xs">
          Amount (₦)
          <input
            name="amount"
            type="number"
            min="1"
            max={koboToNaira(stillHeldKobo)}
            step="any"
            required
            className="mt-1 block h-10 w-32 rounded-lg border border-[color:var(--color-line)] px-3 text-sm tabular-nums"
          />
        </label>
        <input
          name="reason"
          placeholder="Why?"
          required
          className="h-10 flex-1 rounded-lg border border-[color:var(--color-line)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40"
        >
          {pending ? "Refunding…" : "Refund"}
        </button>
      </form>
      {state.error ? <div className="mt-2"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? <div className="mt-2"><Alert tone="success">Sent back to the customer.</Alert></div> : null}
    </Card>
  );
}

const STATUSES = ["paid_held", "accepted", "in_progress", "completed", "cancelled", "disputed"];

/** A blunt instrument, kept out of the way. It moves no money. */
export function ChangeStatus({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(overrideStatusAction, {} as AdminActionState);

  return (
    <Card className="mt-3">
      <h2 className="text-sm font-semibold">Change the booking status by hand</h2>
      <p className="mt-1 text-xs text-[color:var(--color-ink-muted)]">
        Only use this when something went wrong. It changes the booking, not the money.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <select name="status" className="h-10 rounded-lg border border-[color:var(--color-line)] px-3 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          name="reason"
          placeholder="Why?"
          required
          className="h-10 flex-1 rounded-lg border border-[color:var(--color-line)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg border border-[color:var(--color-line)] px-4 text-sm font-medium disabled:opacity-40"
        >
          {pending ? "Changing…" : "Change"}
        </button>
      </form>
      {state.error ? <div className="mt-2"><Alert>{state.error}</Alert></div> : null}
      {state.ok ? <div className="mt-2"><Alert tone="success">Changed.</Alert></div> : null}
    </Card>
  );
}
